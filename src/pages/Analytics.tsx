
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Medication, DoseLog, WeeklyAdherence } from "@/types";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subWeeks, addWeeks } from "date-fns";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";

export default function Analytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyAdherence[]>([]);
  const [mostMissed, setMostMissed] = useState<{ medication: string; count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  
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
        
        // Fetch logs from the past 90 days
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
        
        setLogs(formattedLogs);
        
        // Process data for charts
        calculateWeeklyAdherence(formattedLogs, formattedMeds);
        calculateMostMissed(formattedLogs, formattedMeds);
      } catch (error) {
        console.error("Error fetching analytics data:", error);
        toast.error("Failed to fetch analytics data");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [user]);
  
  // Recalculate weekly data when the selected week changes
  useEffect(() => {
    if (logs.length > 0 && medications.length > 0) {
      calculateWeeklyAdherence(logs, medications);
    }
  }, [currentWeekStart]);
  
  const calculateWeeklyAdherence = (logs: DoseLog[], medications: Medication[]) => {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
    const daysInWeek = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
    
    // Calculate daily adherence for the selected week
    const weeklyAdherenceData: WeeklyAdherence[] = daysInWeek.map(day => {
      // Filter logs for this day
      const dayLogs = logs.filter(log => 
        isSameDay(new Date(log.timestamp), day)
      );
      
      const takenCount = dayLogs.filter(log => log.isOnTime).length;
      const totalCount = dayLogs.length;
      const adherenceRate = totalCount > 0 ? (takenCount / totalCount) * 100 : 0;
      
      return {
        date: format(day, "MMM d"),
        adherenceRate: Math.round(adherenceRate),
        total: totalCount,
        taken: takenCount
      };
    });
    
    setWeeklyData(weeklyAdherenceData);
  };
  
  const calculateMostMissed = (logs: DoseLog[], medications: Medication[]) => {
    // Count missed doses by medication
    const missedByMed: Record<string, { name: string, count: number }> = {};
    
    medications.forEach(med => {
      const medLogs = logs.filter(log => log.medicationId === med.id);
      const missedCount = medLogs.filter(log => !log.isOnTime).length;
      
      if (missedCount > 0) {
        missedByMed[med.id] = { 
          name: med.name,
          count: missedCount 
        };
      }
    });
    
    // Sort by missed count
    const sortedMostMissed = Object.values(missedByMed)
      .map(item => ({ 
        medication: item.name, 
        count: item.count 
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    setMostMissed(sortedMostMissed);
  };
  
  const navigatePreviousWeek = () => {
    setCurrentWeekStart(prev => subWeeks(prev, 1));
  };
  
  const navigateNextWeek = () => {
    const nextWeek = addWeeks(currentWeekStart, 1);
    // Don't allow navigating beyond current week
    if (nextWeek <= startOfWeek(new Date(), { weekStartsOn: 0 })) {
      setCurrentWeekStart(nextWeek);
    }
  };
  
  // Calculate overall adherence
  const calculateOverallAdherence = () => {
    if (logs.length === 0) return 0;
    
    const takenOnTime = logs.filter(log => log.isOnTime).length;
    return Math.round((takenOnTime / logs.length) * 100);
  };
  
  const overallAdherence = calculateOverallAdherence();
  
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
          <h1 className="text-3xl font-bold">Adherence Analytics</h1>
          <p className="text-muted-foreground">Track your medication adherence over time</p>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-12 bg-gray-100"></CardHeader>
                <CardContent className="h-64 bg-gray-50"></CardContent>
              </Card>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <Card className="text-center p-10">
            <CardContent className="pt-10 pb-10">
              <p className="mb-4 text-muted-foreground">
                No medication logs found. Start logging your doses to see analytics.
              </p>
              <Button onClick={() => navigate("/dose-logging")}>
                Log a Dose
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Overall Adherence */}
            <Card>
              <CardHeader>
                <CardTitle>Overall Adherence</CardTitle>
                <CardDescription>Your 90-day medication adherence rate</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <div className="relative h-40 w-40">
                  <svg className="h-40 w-40" viewBox="0 0 100 100">
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
                        ${overallAdherence >= 80 ? 'text-medtrack-green' : 
                          overallAdherence >= 50 ? 'text-medtrack-yellow' : 'text-medtrack-red'}
                        stroke-current
                      `}
                      strokeWidth="10"
                      strokeLinecap="round"
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      strokeDasharray={`${overallAdherence * 2.51} 251.2`}
                      strokeDashoffset="0"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl font-bold">{overallAdherence}%</span>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-lg">
                    {overallAdherence >= 80 ? '😀 Excellent!' : 
                     overallAdherence >= 50 ? '🙂 Good, but room for improvement' : 
                     '😐 Needs improvement'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Based on {logs.length} recorded doses
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {/* Weekly Adherence Chart */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Weekly Adherence</CardTitle>
                  <CardDescription>
                    {format(currentWeekStart, "MMM d")} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), "MMM d, yyyy")}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={navigatePreviousWeek}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={navigateNextWeek}
                    disabled={endOfWeek(addWeeks(currentWeekStart, 1), { weekStartsOn: 0 }) > new Date()}
                  >
                    Next
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={weeklyData}
                    margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} />
                    <Tooltip 
                      formatter={(value: any) => [`${value}%`, 'Adherence Rate']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="adherenceRate"
                      stroke="#10b981"
                      name="Adherence Rate"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* Most Missed Medications */}
            {mostMissed.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Most Missed Medications</CardTitle>
                  <CardDescription>Medications with the highest number of missed doses</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={mostMissed}
                      margin={{ top: 20, right: 20, left: 20, bottom: 60 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis 
                        type="category" 
                        dataKey="medication" 
                        width={150}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar 
                        dataKey="count" 
                        name="Missed Doses" 
                        fill="#ef4444"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
