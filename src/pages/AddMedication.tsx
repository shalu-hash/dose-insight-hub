
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client"; // Fixed import
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, ChevronLeft, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FrequencyType } from "@/types";

const frequencyOptions = [
  { value: "once_daily", label: "Once Daily" },
  { value: "twice_daily", label: "Twice Daily" },
  { value: "three_times_daily", label: "Three Times Daily" },
  { value: "four_times_daily", label: "Four Times Daily" },
  { value: "custom", label: "Custom" },
];

const categoryOptions = [
  { value: "prescription", label: "Prescription" },
  { value: "over_the_counter", label: "Over the Counter" },
  { value: "supplement", label: "Supplement" },
  { value: "vitamin", label: "Vitamin" },
  { value: "other", label: "Other" },
];

const formSchema = z.object({
  name: z.string().min(2, { message: "Medication name is required" }),
  dose: z.string().min(1, { message: "Dose is required" }),
  frequency: z.enum(["once_daily", "twice_daily", "three_times_daily", "four_times_daily", "custom"]),
  startDate: z.date(),
  endDate: z.date().optional(),
  category: z.string().optional(),
  familyMember: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddMedication() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [times, setTimes] = useState<string[]>([]);
  const [timeInput, setTimeInput] = useState("");
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      dose: "",
      frequency: "once_daily" as FrequencyType,
      startDate: new Date(),
      category: "prescription",
    },
  });
  
  const selectedFrequency = form.watch("frequency");
  
  // Set default times when frequency changes
  const updateDefaultTimes = (frequency: FrequencyType) => {
    switch (frequency) {
      case "once_daily":
        setTimes(["08:00"]);
        break;
      case "twice_daily":
        setTimes(["08:00", "20:00"]);
        break;
      case "three_times_daily":
        setTimes(["08:00", "14:00", "20:00"]);
        break;
      case "four_times_daily":
        setTimes(["08:00", "12:00", "16:00", "20:00"]);
        break;
      case "custom":
        // Keep existing times
        break;
    }
  };
  
  const onFrequencyChange = (value: FrequencyType) => {
    form.setValue("frequency", value);
    if (value !== "custom") {
      updateDefaultTimes(value);
    }
  };
  
  const addTime = () => {
    if (timeInput && !times.includes(timeInput)) {
      setTimes([...times, timeInput]);
      setTimeInput("");
    }
  };
  
  const removeTime = (index: number) => {
    const newTimes = [...times];
    newTimes.splice(index, 1);
    setTimes(newTimes);
  };
  
  const onSubmit = async (data: FormValues) => {
    try {
      if (!user) {
        toast.error("You must be logged in to add a medication");
        return;
      }
      
      if (times.length === 0) {
        toast.error("Please add at least one time for your medication");
        return;
      }
      
      const medication = {
        name: data.name,
        dose: data.dose,
        frequency: data.frequency,
        times: times,
        start_date: data.startDate.toISOString(),
        end_date: data.endDate ? data.endDate.toISOString() : null,
        category: data.category,
        family_member: data.familyMember, // Fixed field name to match database column
        user_id: user.id,
        created_at: new Date().toISOString()
      };
      
      const { data: result, error } = await supabase
        .from('medications')
        .insert([medication])
        .select();
        
      if (error) throw error;
      
      toast.success("Medication added successfully!");
      navigate("/medications");
    } catch (error: any) {
      console.error("Error adding medication:", error);
      toast.error(error.message || "Failed to add medication");
    }
  };
  
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate("/medications")}
            className="mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Medications
          </Button>
          <h1 className="text-3xl font-bold">Add New Medication</h1>
          <p className="text-muted-foreground">Enter your medication details below</p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medication Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter medication name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="dose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dose</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 10mg, 1 tablet, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select onValueChange={(value) => onFrequencyChange(value as FrequencyType)} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {frequencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-2">
              <FormLabel>Medication Times</FormLabel>
              <div className="flex flex-wrap gap-2 mb-2">
                {times.map((time, index) => (
                  <div key={index} className="flex items-center bg-secondary rounded-full px-3 py-1">
                    <span className="text-sm">{time}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-1"
                      onClick={() => removeTime(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  className="w-auto"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addTime}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Time
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          disabled={(date) => 
                            form.getValues("startDate") && date < form.getValues("startDate")
                          }
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="familyMember"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Family Member (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Self, Child, Parent" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex gap-4 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/medications")}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                Save Medication
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
