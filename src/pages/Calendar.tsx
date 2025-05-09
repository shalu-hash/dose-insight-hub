
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Medication, DoseLog } from "@/types";
import { ChevronLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay } from "date-fns";

export default function Calendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [date, setDate] = useState<Date>(new Date());
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<DoseLog[]>([]);
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
        
        // Fetch logs
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const { data: logsData, error: logsError } = await supabase
          .from('dose_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('timestamp', monthStart.toISOString())
          .lte('timestamp', monthEnd.toISOString());
          
        if (logsError) throw logsError;
        
        const formattedLogs = logsData.map((log: any) => ({
          id: log.id,
          medicationId: log.medication_id,
          timestamp: log.timestamp,
          isOnTime: log.is_on_time,
          userId: log.user_id
        }));
        
        setLogs(formattedLogs);
      } catch (error) {
        console.error("Error fetching calendar data:", error);
        toast.error("Failed to fetch calendar data");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [user, date.getMonth()]);
  
  // Get medications scheduled for the selected date
  const getScheduledMedications = () => {
    return medications.filter(med => {
      const startDate = new Date(med.startDate);
      const endDate = med.endDate ? new Date(med.endDate) : null;
      
      // Check if medication is active on the selected date
      return (
        startDate <= date && 
        (!endDate || endDate >= date)
      );
    });
  };
  
  // Get logs for the selected date
  const getLogsForDate = () => {
    return logs.filter(log => 
      isSameDay(new Date(log.timestamp), date)
    );
  };
  
  // Check if a medication has been taken on the selected date
  const isMedicationTaken = (medicationId: string) => {
    return getLogsForDate().some(log => 
      log.medicationId === medicationId
    );
  };
  
  const handleLogDose = async (medicationId: string) => {
    if (!user) return;
    
    // Check if already logged for today
    if (isMedicationTaken(medicationId)) {
      toast.info("You've already logged this medication today");
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('dose_logs')
        .insert([
          { 
            medication_id: medicationId,
            timestamp: new Date().toISOString(),
            is_on_time: true,
            user_id: user.id
          }
        ])
        .select();
        
      if (error) throw error;
      
      toast.success("Dose logged successfully!");
      
      // Update logs state
      if (data && data[0]) {
        const newLog = {
          id: data[0].id,
          medicationId: data[0].medication_id,
          timestamp: data[0].timestamp,
          isOnTime: data[0].is_on_time,
          userId: data[0].user_id
        };
        
        setLogs([...logs, newLog]);
      }
    } catch (error: any) {
      console.error("Error logging dose:", error);
      toast.error(error.message || "Failed to log dose");
    }
  };
  
  // Function to determine if a date has any medication taken
  const getDayHasMedication = (day: Date) => {
    const dayLogs = logs.filter(log => 
      isSameDay(new Date(log.timestamp), day)
    );
    
    return dayLogs.length > 0;
  };
  
  const scheduledMedications = getScheduledMedications();
  const dateHasLogs = getLogsForDate().length > 0;
  
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
          <h1 className="text-3xl font-bold">Medication Calendar</h1>
          <p className="text-muted-foreground">View and manage your medication schedule</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Select Date</CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarComponent 
                mode="single"
                selected={date}
                onSelect={(newDate) => newDate && setDate(newDate)}
                className="rounded-md border"
                modifiers={{
                  hasMedication: (day) => getDayHasMedication(day)
                }}
                modifiersStyles={{
                  hasMedication: { 
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    fontWeight: "bold" 
                  }
                }}
              />
              <div className="mt-4 text-sm text-muted-foreground text-center">
                {format(date, "EEEE, MMMM d, yyyy")}
              </div>
            </CardContent>
          </Card>
          
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>
                {isLoading ? "Loading..." : `Medications for ${format(date, "MMMM d")}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-gray-100 animate-pulse rounded"></div>
                  ))}
                </div>
              ) : scheduledMedications.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No medications scheduled for this date</p>
                  <Button 
                    variant="link" 
                    onClick={() => navigate("/medications/new")}
                    className="mt-2"
                  >
                    Add a Medication
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {scheduledMedications.map(medication => {
                    const taken = isMedicationTaken(medication.id);
                    
                    return (
                      <div 
                        key={medication.id} 
                        className={`p-4 border rounded flex justify-between items-center
                          ${taken ? 'bg-green-50 border-green-200' : 'bg-white'}`}
                      >
                        <div>
                          <div className="font-medium">{medication.name}</div>
                          <div className="text-sm text-muted-foreground">{medication.dose}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {medication.times.map((time) => time).join(", ")}
                          </div>
                        </div>
                        <div>
                          {taken ? (
                            <div className="flex items-center text-medtrack-green">
                              <Check className="h-5 w-5 mr-2" />
                              <span>Taken</span>
                            </div>
                          ) : (
                            <Button 
                              onClick={() => handleLogDose(medication.id)}
                              className="bg-medtrack-green hover:bg-medtrack-green/90"
                            >
                              Take Now
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {dateHasLogs && (
                <div className="mt-8 pt-6 border-t">
                  <h3 className="font-medium mb-4">Logged Doses</h3>
                  <div className="space-y-2">
                    {getLogsForDate().map((log) => {
                      const medication = medications.find(med => med.id === log.medicationId);
                      
                      return (
                        <div key={log.id} className="flex items-center gap-2 text-sm">
                          <div className={log.isOnTime ? "text-medtrack-green" : "text-medtrack-red"}>
                            {log.isOnTime ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            {medication?.name || "Unknown"} - {format(new Date(log.timestamp), "h:mm a")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
