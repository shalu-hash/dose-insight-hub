
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Medication } from "@/types";
import { toast } from "sonner";

export default function Medications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMedications = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('medications')
          .select('*')
          .eq('user_id', user.id);
          
        if (error) throw error;
        
        const formattedMeds = data.map((med: any) => ({
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
      } catch (error) {
        console.error("Error fetching medications:", error);
        toast.error("Failed to fetch medications");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMedications();
  }, [user]);

  const handleLogDose = async (medicationId: string) => {
    navigate(`/dose-logging?medicationId=${medicationId}`);
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">My Medications</h1>
            <p className="text-muted-foreground">Manage your medication list</p>
          </div>
          <Button onClick={() => navigate("/medications/new")}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Medication
          </Button>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-24 bg-gray-100"></CardHeader>
                <CardContent className="h-32 bg-gray-50"></CardContent>
              </Card>
            ))}
          </div>
        ) : medications.length === 0 ? (
          <Card className="text-center p-10">
            <CardContent className="pt-10 pb-10">
              <p className="mb-4 text-muted-foreground">You haven't added any medications yet</p>
              <Button onClick={() => navigate("/medications/new")}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Your First Medication
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {medications.map((medication) => (
              <Card key={medication.id}>
                <CardHeader>
                  <CardTitle>{medication.name}</CardTitle>
                  <CardDescription>{medication.dose}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Frequency:</span>
                      <span>{medication.frequency.replace(/_/g, ' ')}</span>
                    </div>
                    {medication.category && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Category:</span>
                        <span>{medication.category}</span>
                      </div>
                    )}
                    {medication.familyMember && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">For:</span>
                        <span>{medication.familyMember}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={() => handleLogDose(medication.id)} 
                    className="w-full bg-medtrack-green hover:bg-medtrack-green/90"
                  >
                    Take Now
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
