export interface SafetyObservation {
  id?: string;
  project_id: string;
  company_id: string;
  submitter_name: string;
  date: string;
  time: string;
  location: string;
  description: string;
  subject: 'SOSV : Safety Observation Site Visit' | 'SOP' | 'RES';
  report_group: 'operations' | 'maintenance' | 'safety' | 'contractors';
  consequences: 'minor' | 'moderate' | 'major' | 'severe';
  likelihood: 'unlikely' | 'possible' | 'likely' | 'very-likely';
  status: 'open' | 'closed';
  corrective_action: boolean;
  supporting_image?: string | File;
  created_at?: string;
  created_by?: string;
  selected_categories?: string[];
}

export interface ActionPlan {
  id?: string;
  observation_id?: string;
  action: string;
  due_date: string;
  responsible_person: string;
  follow_up_contact: string;
  status: 'open' | 'closed';
  supporting_image?: string;
  created_at?: string;
  created_by?: string;
}

export interface Project {
  id: string;
  name: string;
}

export interface Company {
  id: string;
  name: string;
}

export interface SafetyCategory {
  id: string;
  name: string;
  icon: string;
}

export interface MonthlySummary {
  month: string;
  total_observations: number;
  observation_types: Record<string, number>;
  report_status: Record<string, number>;
  risk_levels: Record<string, number>;
  trending_data: {
    categories: Record<string, number>;
  };
  created_at?: string;
  updated_at?: string;
}

export interface Report {
  id: number;
  subject: string;
  project: string;
  company: string;
  submitter_name: string;
  date: string;
  time: string;
  location: string;
  department: string;
  description: string;
  report_group: string;
  consequences: string;
  likelihood: string;
  status: string;
  safety_categories: SafetyCategory[];
  action_plans: ActionPlan[];
  supporting_image: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafetyReport {
  id: string;
  subject: string;
  submitter_name: string;
  date: string;
  description: string;
  consequences: string;
  status: string;
  created_at: string;
  created_by: string;
  projects: { id: string; name: string };
  companies: { id: string; name: string };
  supporting_image?: string;
  department?: string;
  location?: string;
  report_group?: string;
  likelihood?: string;
  safety_categories?: SafetyCategory[];
  action_plans: {
    id: string;
    action: string;
    due_date: string;
    responsible_person: string;
    follow_up_contact: string;
    status: string;
    supporting_image?: string;
  }[];
}