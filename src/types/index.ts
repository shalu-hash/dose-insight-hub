
export type User = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

export type FrequencyType = 'once_daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'custom';

export type Medication = {
  id: string;
  name: string;
  dose: string;
  frequency: FrequencyType;
  times: string[];
  startDate: string;
  endDate?: string;
  category?: string;
  familyMember?: string;
  userId: string;
  createdAt: string;
};

export type DoseLog = {
  id: string;
  medicationId: string;
  timestamp: string;
  isOnTime: boolean;
  userId: string;
};

export type WeeklyAdherence = {
  date: string;
  adherenceRate: number;
  total: number;
  taken: number;
};

export type AdherenceStat = {
  adherenceRate: number;
  totalDoses: number;
  takenDoses: number;
  missedDoses: number;
  mostMissed: { medication: string; count: number }[];
};
