
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Medication, DoseLog, AdherenceStat } from "@/types";
import { Calendar, Clock, PlusCircle, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay, addHours, isAfter, isBefore } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [upcomingDoses, setUpcomingDoses] = useState<{medication: Medication, dueTime: Date}[]>([]);
  const [recentLogs, setRecentLogs] = useState<DoseLog[]>([]);
  const [adherenceStats, setAdherenceStats] = useState<AdherenceStat>({
    adherenceRate: 0,
    totalDoses: 0,
    takenDoses: 0,
    missedDoses: 0,
    mostMissed: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
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
        
        // Calculate upcoming doses
        const now = new Date();
        const upcoming = formattedMeds
          .filter(med => {
            const startDate = new Date(med.startDate);
            const endDate = med.endDate ? new Date(med.endDate) : null;
            return (
              !endDate || isAfter(endDate, now)) && 
              !isBefore(now, startDate
            );
          })
          .flatMap(med => {
            return (med.times || []).map(timeStr => {
              const [hours, minutes] = timeStr.split(':').map(Number);
              const dueTime = new Date();
              dueTime.setHours(hours, minutes, 0, 0);
              
              // If the time has passed for today, set it for tomorrow
              if (isBefore(dueTime, now)) {
                dueTime.setDate(dueTime.getDate() + 1);
              }
              
              return { medication: med, dueTime };
            });
          })
          .sort((a, b) => a.dueTime.getTime() - b.dueTime.getTime())
          .slice(0, 3);
          
        setUpcomingDoses(upcoming);
        
        // Fetch recent logs
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
        const { data: logsData, error: logsError } = await supabase
          .from('dose_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('timestamp', threeMonthsAgo.toISOString());
          
        if (logsError) throw logsError;
        
        const formattedLogs = logsData.map((log: any) => ({
          id: log.id,
          medicationId: log.medication_id,
          timestamp: log.timestamp,
          isOnTime: log.is_on_time,
          userId: log.user_id
        }));
        
        setRecentLogs(formattedLogs);
        
        // Calculate adherence stats
        const totalDoses = formattedLogs.length;
        const takenOnTime = formattedLogs.filter(log => log.isOnTime).length;
        const adherenceRate = totalDoses > 0 ? (takenOnTime / totalDoses) * 100 : 0;
        
        // Get most missed medications
        const missedByMed: Record<string, number> = {};
        formattedMeds.forEach(med => {
          const medLogs = formattedLogs.filter(log => log.medicationId === med.id);
          const missedCount = medLogs.filter(log => !log.isOnTime).length;
          if (missedCount > 0) {
            missedByMed[med.name] = missedCount;
          }
        });
        
        const sortedMostMissed = Object.entries(missedByMed)
          .map(([medication, count]) => ({ medication, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
        
        setAdherenceStats({
          adherenceRate,
          totalDoses,
          takenDoses: takenOnTime,
          missedDoses: totalDoses - takenOnTime,
          mostMissed: sortedMostMissed
        });
        
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast.error("Failed to fetch dashboard data");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [user]);

  const handleLogDose = async (medicationId: string) => {
    navigate(`/dose-logging?medicationId=${medicationId}`);
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Welcome to MedTrack</h1>
          <p className="text-muted-foreground">
            Track your medications and monitor your adherence
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Adherence Rate Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Adherence Rate</CardTitle>
              <CardDescription>Your 90-day adherence</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <div className="relative h-24 w-24">
                  <svg className="h-24 w-24" viewBox="0 0 100 100">
                    {/* Background circle */}
                    <circle
                      className="text-muted stroke-current"
                      strokeWidth="10"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                    />
                    {/* Foreground circle */}
                    <circle
                      className={`
                        ${adherenceStats.adherenceRate >= 80 ? 'text-medtrack-green' : 
                          adherenceStats.adherenceRate >= 50 ? 'text-medtrack-yellow' : 'text-medtrack-red'}
                        stroke-current
                      `}
                      strokeWidth="10"
                      strokeLinecap="round"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      strokeDasharray={`${adherenceStats.adherenceRate * 2.51} 251.2`}
                      strokeDashoffset="0"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold">{Math.round(adherenceStats.adherenceRate)}%</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {adherenceStats.takenDoses} of {adherenceStats.totalDoses} doses taken
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/analytics')}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
            </CardFooter>
          </Card>
          
          {/* Upcoming Doses Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Upcoming Doses</CardTitle>
              <CardDescription>Your next scheduled medications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingDoses.length > 0 ? (
                  upcomingDoses.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{item.medication.name}</div>
                        <div className="text-sm text-muted-foreground">{item.medication.dose}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{format(item.dueTime, 'h:mm a')}</div>
                        <div className="text-xs text-muted-foreground">{format(item.dueTime, 'MMM d')}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No upcoming doses
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/dose-logging')}
              >
                <Clock className="h-4 w-4 mr-2" />
                Log Doses
              </Button>
            </CardFooter>
          </Card>
          
          {/* Medications Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">My Medications</CardTitle>
              <CardDescription>Your active medications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {medications.length > 0 ? (
                  medications.slice(0, 3).map((med) => (
                    <div key={med.id} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{med.name}</div>
                        <div className="text-sm text-muted-foreground">{med.dose}</div>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => handleLogDose(med.id)}
                        className="bg-medtrack-green hover:bg-medtrack-green/90"
                      >
                        Take Now
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No medications added yet
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/medications')}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Manage Medications
              </Button>
            </CardFooter>
          </Card>
          
          {/* Calendar Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Schedule</CardTitle>
              <CardDescription>Your medication calendar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <Calendar className="h-20 w-20 text-medtrack-blue" />
              </div>
              <div className="text-center mt-2">
                <p className="font-medium">View your medication schedule</p>
                <p className="text-sm text-muted-foreground">Track all your medications in one place</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/calendar')}
              >
                <Calendar className="h-4 w-4 mr-2" />
                View Calendar
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center"
              onClick={() => navigate('/medications/new')}
            >
              <PlusCircle className="h-8 w-8 mb-2" />
              <span>Add Medication</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center"
              onClick={() => navigate('/dose-logging')}
            >
              <Clock className="h-8 w-8 mb-2" />
              <span>Log Dose</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center"
              onClick={() => navigate('/calendar')}
            >
              <Calendar className="h-8 w-8 mb-2" />
              <span>View Schedule</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 flex flex-col items-center"
              onClick={() => navigate('/analytics')}
            >
              <BarChart3 className="h-8 w-8 mb-2" />
              <span>View Analytics</span>
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
