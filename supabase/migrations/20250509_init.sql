
-- Create medications table
CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  dose TEXT NOT NULL,
  frequency TEXT NOT NULL,
  times TEXT[] NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  category TEXT,
  family_member TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dose_logs table
CREATE TABLE IF NOT EXISTS dose_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  is_on_time BOOLEAN DEFAULT TRUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Row Level Security (RLS) policies
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE dose_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for medications table
CREATE POLICY "Users can view their own medications" ON medications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own medications" ON medications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own medications" ON medications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own medications" ON medications
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for dose_logs table
CREATE POLICY "Users can view their own dose logs" ON dose_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dose logs" ON dose_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dose logs" ON dose_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dose logs" ON dose_logs
  FOR DELETE USING (auth.uid() = user_id);
