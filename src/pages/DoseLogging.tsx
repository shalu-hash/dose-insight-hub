
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Medication, DoseLog } from "@/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, XCircle, ChevronLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DoseLogging() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const preselectedMedicationId = queryParams.get("medicationId");
  
  const [medications, setMedications] = useState<Medication[]>([]);
  const [selectedMedicationId, setSelectedMedicationId] = useState<string>(preselectedMedicationId || "");
  const [recentLogs, setRecentLogs] = useState<DoseLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        // Fetch medications
        const { data: medsData, error: medsError } = await supabase
          .from('medications')
          .select('*')
          .eq('user_id', user.id);
          
        if (medsError) throw medsError;
        
        const formattedMeds = medsData.map((med: any) => ({
          id: med.id,
          name: med.name,
          dose: med.dose,
          frequency: med.frequency,
          times: med.times || [],
          startDate: med.start_date,
          endDate: med.end_date,
          category: med.category,
          familyMember: med.family_member,
          userId: med.user_id,
          createdAt: med.created_at
        }));
        
        setMedications(formattedMeds);
        
        // Fetch recent logs
        const { data: logsData, error: logsError } = await supabase
          .from('dose_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(10);
          
        if (logsError) throw logsError;
        
        const formattedLogs = logsData.map((log: any) => ({
          id: log.id,
          medicationId: log.medication_id,
          timestamp: log.timestamp,
          isOnTime: log.is_on_time,
          userId: log.user_id
        }));
        
        setRecentLogs(formattedLogs);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to fetch data");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [user]);
  
  const handleLogDose = async () => {
    if (!selectedMedicationId || !user) {
      toast.error("Please select a medication");
      return;
    }
    
    try {
      const now = new Date();
      const { data, error } = await supabase
        .from('dose_logs')
        .insert([
          { 
            medication_id: selectedMedicationId,
            timestamp: now.toISOString(),
            is_on_time: true,
            user_id: user.id
          }
        ])
        .select();
        
      if (error) throw error;
      
      toast.success("Dose logged successfully!");
      
      // Update the UI with the new log
      if (data && data[0]) {
        const newLog = {
          id: data[0].id,
          medicationId: data[0].medication_id,
          timestamp: data[0].timestamp,
          isOnTime: data[0].is_on_time,
          userId: data[0].user_id
        };
        
        setRecentLogs([newLog, ...recentLogs]);
      }
      
      // Reset selection
      setSelectedMedicationId("");
    } catch (error: any) {
      console.error("Error logging dose:", error);
      toast.error(error.message || "Failed to log dose");
    }
  };
  
  const getMedicationName = (id: string) => {
    const medication = medications.find(med => med.id === id);
    return medication ? medication.name : "Unknown Medication";
  };
  
  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Dose Logging</h1>
          <p className="text-muted-foreground">Log your medication doses and track your history</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Log a Dose</CardTitle>
              <CardDescription>Record when you've taken your medication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Medication</label>
                <Select 
                  value={selectedMedicationId} 
                  onValueChange={setSelectedMedicationId}
                  disabled={isLoading || medications.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a medication" />
                  </SelectTrigger>
                  <SelectContent>
                    {medications.map(med => (
                      <SelectItem key={med.id} value={med.id}>
                        {med.name} ({med.dose})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="text-center pt-4">
                <p className="text-sm mb-2 text-muted-foreground">
                  Current time: {format(new Date(), "h:mm a, MMM d, yyyy")}
                </p>
                <Button 
                  onClick={handleLogDose} 
                  disabled={!selectedMedicationId}
                  className="w-full bg-medtrack-green hover:bg-medtrack-green/90"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Taken
                </Button>
              </div>
              
              {medications.length === 0 && !isLoading && (
                <div className="text-center mt-4 p-4 bg-muted/50 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    You haven't added any medications yet.
                  </p>
                  <Button
                    variant="link"
                    onClick={() => navigate("/medications/new")}
                    className="mt-2"
                  >
                    Add a Medication
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Logs</CardTitle>
              <CardDescription>Your recently recorded doses</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-gray-100 animate-pulse rounded"></div>
                  ))}
                </div>
              ) : recentLogs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No dose logs yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentLogs.map(log => (
                    <div 
                      key={log.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <div className="font-medium">{getMedicationName(log.medicationId)}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(log.timestamp), "h:mm a, MMM d")}
                        </div>
                      </div>
                      {log.isOnTime ? (
                        <CheckCircle className="h-5 w-5 text-medtrack-green" />
                      ) : (
                        <XCircle className="h-5 w-5 text-medtrack-red" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
