import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import * as lucide from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ExportReport } from '../components/ExportReport';
import { SafetyCategories } from '../components/SafetyCategories';
import toast from 'react-hot-toast';
import type { SafetyCategory, Project, Company, Report } from '../lib/types';
import safetyLogo from '../images/safety_b_line_logo.png';

interface ActionPlan {
  id?: string;
  action: string;
  due_date: string;
  responsible_person: string;
  follow_up_contact: string;
  status: 'open' | 'closed';
  supporting_image: string;
}

function sanitizeFilename(filename: string) {
  return filename
    .normalize('NFD').replace(/[ -\u001F\u007F-\u009F\u0300-\u036f]/g, '') // Remove accents and control chars
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // Only allow safe characters
}

export function ReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'view' ? 'view' : 'edit';
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [safetyCategories, setSafetyCategories] = useState<SafetyCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [currentActionPlan, setCurrentActionPlan] = useState<ActionPlan>({
    action: '',
    due_date: '',
    responsible_person: '',
    follow_up_contact: '',
    status: 'open',
    supporting_image: ''
  });
  const [actionPlanRequired, setActionPlanRequired] = useState('no');
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  // Form state
  const [project, setProject] = useState('');
  const [company, setCompany] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [reportGroup, setReportGroup] = useState('');
  const [consequences, setConsequences] = useState('');
  const [likelihood, setLikelihood] = useState('');
  const [status, setStatus] = useState('open');
  const [subject, setSubject] = useState<'SOSV : Safety Observation Site Visit' | 'SOP' | 'RES'>('SOSV : Safety Observation Site Visit');

  const [editingActionPlanIndex, setEditingActionPlanIndex] = useState<number | null>(null);
  const [editedActionPlan, setEditedActionPlan] = useState<ActionPlan | null>(null);
  const [editedActionPlanImageFile, setEditedActionPlanImageFile] = useState<File | null>(null);
  const [editedActionPlanImagePreview, setEditedActionPlanImagePreview] = useState('');

  // Add a new state to track deleted action plan IDs
  const [deletedActionPlanIds, setDeletedActionPlanIds] = useState<string[]>([]);

  // Add new state for pending action plan changes
  const [pendingActionPlans, setPendingActionPlans] = useState<ActionPlan[]>([]);
  const [isActionPlansLoaded, setIsActionPlansLoaded] = useState(false);

  const [actionPlanImageFile, setActionPlanImageFile] = useState<File | null>(null);
  const [actionPlanImagePreview, setActionPlanImagePreview] = useState('');

  // Memoize the transformed report data
  const transformedReport = useMemo(() => {
    if (!report) return null;
    return {
      id: report.id,
      subject: report.subject,
      project: report.project,
      company: report.company,
      submitter_name: report.submitter_name,
      date: report.date,
      time: report.time,
      location: report.location,
      department: report.department,
      description: report.description,
      report_group: report.report_group,
      consequences: report.consequences,
      likelihood: report.likelihood,
      status: report.status,
      safety_categories: report.safety_categories,
      action_plans: report.action_plans,
      supporting_image: report.supporting_image,
      created_at: report.created_at,
      updated_at: report.updated_at
    };
  }, [report]);

  // Memoize the action plans
  const memoizedActionPlans = useMemo(() => {
    return actionPlans.map(plan => ({
      ...plan,
      due_date: format(new Date(plan.due_date), 'MMMM d, yyyy')
    }));
  }, [actionPlans]);

  // Memoize handlers
  const handleCategorySelect = useCallback((categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  }, []);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Optimize the loadReport function
  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load report data and action plans in parallel
      const [reportResult, actionPlansResult] = await Promise.all([
        supabase
          .from('observation_details')
          .select(`
            *,
            projects(name),
            companies(name)
          `)
          .eq('id', id)
          .single(),
        supabase
          .from('action_plans')
          .select('*')
          .eq('observation_id', id)
      ]);

      if (reportResult.error) throw reportResult.error;
      if (actionPlansResult.error) throw actionPlansResult.error;

      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('observation_categories')
        .select('category_id')
        .eq('observation_id', id);

      if (categoriesError) throw categoriesError;

      // Transform and set data
      const transformedReport: Report = {
        id: reportResult.data.id,
        subject: reportResult.data.subject,
        project: reportResult.data.projects.name,
        company: reportResult.data.companies.name,
        submitter_name: reportResult.data.submitter_name,
        date: reportResult.data.date,
        time: reportResult.data.time,
        location: reportResult.data.location,
        department: reportResult.data.department,
        description: reportResult.data.description,
        report_group: reportResult.data.report_group,
        consequences: reportResult.data.consequences,
        likelihood: reportResult.data.likelihood,
        status: reportResult.data.status,
        safety_categories: categoriesData?.map(c => ({ 
          id: c.category_id, 
          name: '', 
          description: '', 
          icon: 'default',
          created_at: '', 
          updated_at: '' 
        })) || [],
        action_plans: actionPlansResult.data || [],
        supporting_image: reportResult.data.supporting_image,
        created_at: reportResult.data.created_at,
        updated_at: reportResult.data.updated_at
      };

      setReport(transformedReport);
      setSelectedCategories(categoriesData?.map(c => c.category_id) || []);
      setActionPlans(actionPlansResult.data || []);
      setPendingActionPlans(actionPlansResult.data || []);
      setIsActionPlansLoaded(true);
      setActionPlanRequired(actionPlansResult.data?.length > 0 ? 'yes' : 'no');

      // Set form state
      setProject(reportResult.data.project_id);
      setCompany(reportResult.data.company_id);
      setSubmitterName(reportResult.data.submitter_name);
      setDate(reportResult.data.date);
      setTime(reportResult.data.time);
      setDepartment(reportResult.data.department);
      setLocation(reportResult.data.location);
      setDescription(reportResult.data.description);
      setReportGroup(reportResult.data.report_group);
      setConsequences(reportResult.data.consequences);
      setLikelihood(reportResult.data.likelihood);
      setStatus(reportResult.data.status);
      setSubject(reportResult.data.subject);

      if (reportResult.data.supporting_image) {
        setImagePreview(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/safety-images/${reportResult.data.supporting_image}`);
      }
    } catch (err) {
      setError('Failed to load report');
      console.error('Error loading report:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load data in parallel
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        loadReport(),
        loadSafetyCategories(),
        loadProjects(),
        loadCompanies()
      ]);
    };
    loadData();
  }, [id, loadReport]);

  const loadSafetyCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('safety_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setSafetyCategories(data);
    } catch (err) {
      console.error('Error loading safety categories:', err);
    }
  };

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name');

      if (error) throw error;
      setProjects(data);
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  };

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name');

      if (error) throw error;
      setCompanies(data);
    } catch (err) {
      console.error('Error loading companies:', err);
    }
  };

  const handleAddActionPlan = () => {
    if (actionPlans.length >= 10) {
      toast.error('Maximum of 10 action plans allowed per report');
      return;
    }
    const newActionPlan: ActionPlan = {
      id: `temp-${Date.now()}`,
      action: '',
      due_date: '',
      responsible_person: '',
      follow_up_contact: '',
      status: 'open',
      supporting_image: ''
    };
    setActionPlans([...actionPlans, newActionPlan]);
  };

  const handleDeleteActionPlan = async (index: number) => {
    if (!window.confirm('Are you sure you want to delete this action plan? This action cannot be undone.')) {
      return;
    }
    
    try {
      const planToDelete = actionPlans[index];
      if (planToDelete.id && !planToDelete.id.startsWith('temp-')) {
        const { error: deleteError } = await supabase
          .from('action_plans')
          .delete()
          .eq('id', planToDelete.id);

        if (deleteError) throw deleteError;
      }
      
      const updatedActionPlans = actionPlans.filter((_, i) => i !== index);
      setActionPlans(updatedActionPlans);
      toast.success('Action plan deleted successfully');
    } catch (err) {
      console.error('Error deleting action plan:', err);
      toast.error('Failed to delete action plan');
    }
  };

  const handleActionPlanImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setActionPlanImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setActionPlanImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveActionPlan = async (addAnother: boolean) => {
    if (!currentActionPlan.action || !currentActionPlan.due_date || 
        !currentActionPlan.responsible_person || !currentActionPlan.follow_up_contact) {
      toast.error('Please fill in all action plan fields');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Upload image if exists
      let imagePath = '';
      if (actionPlanImageFile) {
        const fileName = `${Date.now()}-${sanitizeFilename(actionPlanImageFile.name)}`;
        const { data: imageData, error: imageError } = await supabase.storage
          .from('action-plan-images')
          .upload(fileName, actionPlanImageFile);

        if (imageError) throw imageError;
        imagePath = imageData.path;
      }

      // Save to database
      const { data: savedPlan, error: saveError } = await supabase
        .from('action_plans')
        .insert({
          observation_id: id,
          action: currentActionPlan.action,
          due_date: currentActionPlan.due_date,
          responsible_person: currentActionPlan.responsible_person,
          follow_up_contact: currentActionPlan.follow_up_contact,
          status: currentActionPlan.status,
          supporting_image: imagePath,
          created_by: user.id
        })
        .select()
        .single();

      if (saveError) throw saveError;

      // Update local state
      setActionPlans(prev => [...prev, savedPlan]);
      
      // Reset the form
      setCurrentActionPlan({
        action: '',
        due_date: '',
        responsible_person: '',
        follow_up_contact: '',
        status: 'open',
        supporting_image: ''
      });
      setActionPlanImageFile(null);
      setActionPlanImagePreview('');

      if (!addAnother) {
        setActionPlanRequired('no');
      }

      toast.success('Action plan saved successfully');
    } catch (err) {
      console.error('Error saving action plan:', err);
      toast.error('Failed to save action plan');
    }
  };

  const handleEditActionPlan = (index: number) => {
    setEditingActionPlanIndex(index);
    setEditedActionPlan(actionPlans[index]);
    setEditedActionPlanImageFile(null);
    setEditedActionPlanImagePreview('');
  };

  const handleCancelEditActionPlan = () => {
    setEditingActionPlanIndex(null);
    setEditedActionPlan(null);
  };

  const handleEditedActionPlanImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditedActionPlanImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditedActionPlanImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEditedActionPlan = async () => {
    if (editingActionPlanIndex !== null && editedActionPlan) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Upload new image if exists
        let imagePath = editedActionPlan.supporting_image;
        if (editedActionPlanImageFile) {
          const fileName = `${Date.now()}-${sanitizeFilename(editedActionPlanImageFile.name)}`;
          const { data: imageData, error: imageError } = await supabase.storage
            .from('action-plan-images')
            .upload(fileName, editedActionPlanImageFile);

          if (imageError) throw imageError;
          imagePath = imageData.path;
        }

        // Update the database
        const { error: updateError } = await supabase
          .from('action_plans')
          .update({
            action: editedActionPlan.action,
            due_date: editedActionPlan.due_date,
            responsible_person: editedActionPlan.responsible_person,
            follow_up_contact: editedActionPlan.follow_up_contact,
            status: editedActionPlan.status,
            supporting_image: imagePath
          })
          .eq('id', editedActionPlan.id);

        if (updateError) throw updateError;

        // Update local state
        const updatedActionPlans = [...actionPlans];
        updatedActionPlans[editingActionPlanIndex] = {
          ...editedActionPlan,
          action: editedActionPlan.action,
          due_date: editedActionPlan.due_date,
          responsible_person: editedActionPlan.responsible_person,
          follow_up_contact: editedActionPlan.follow_up_contact,
          status: editedActionPlan.status,
          supporting_image: imagePath
        };
        setActionPlans(updatedActionPlans);
        setEditingActionPlanIndex(null);
        setEditedActionPlan(null);
        setEditedActionPlanImageFile(null);
        setEditedActionPlanImagePreview('');
        
        toast.success('Action plan updated successfully');
      } catch (err) {
        console.error('Error updating action plan:', err);
        toast.error('Failed to update action plan');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Validate required fields
      if (!project || !company || !submitterName || !date || !time || !location || !description || !reportGroup || !consequences || !likelihood || !subject) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Validate field values
      if (!['SOSV : Safety Observation Site Visit', 'SOP', 'RES'].includes(subject)) {
        toast.error('Invalid subject value');
        return;
      }

      if (!['finding', 'positive'].includes(reportGroup)) {
        toast.error('Invalid report group value');
        return;
      }

      if (!['minor', 'moderate', 'major', 'severe'].includes(consequences)) {
        toast.error('Invalid consequences value');
        return;
      }

      if (!['unlikely', 'possible', 'likely', 'very-likely'].includes(likelihood)) {
        toast.error('Invalid likelihood value');
        return;
      }

      // Upload new image if exists
      let imagePath = report?.supporting_image || '';
      if (imageFile) {
        const fileName = `${Date.now()}-${sanitizeFilename(imageFile.name)}`;
        const { data: imageData, error: imageError } = await supabase.storage
          .from('safety-images')
          .upload(fileName, imageFile);

        if (imageError) throw imageError;
        imagePath = imageData.path;
      }

      // Update the report
      const { error: updateError } = await supabase
        .from('observation_details')
        .update({
          project_id: project,
          company_id: company,
          submitter_name: submitterName,
          date,
          time,
          department,
          location,
          description,
          report_group: reportGroup,
          consequences,
          likelihood,
          status,
          subject,
          supporting_image: imagePath
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // If the report is being closed, update all action plans to closed
      if (status === 'closed') {
        const { error: actionPlansError } = await supabase
          .from('action_plans')
          .update({ status: 'closed' })
          .eq('observation_id', id);

        if (actionPlansError) throw actionPlansError;

        // Update local state to reflect the changes
        setActionPlans(prevPlans => 
          prevPlans.map(plan => ({
            ...plan,
            status: 'closed'
          }))
        );
      }

      // Update categories
      if (selectedCategories.length > 0) {
        // First delete existing categories
        const { error: deleteError } = await supabase
          .from('observation_categories')
          .delete()
          .eq('observation_id', id);

        if (deleteError) throw deleteError;

        // Then insert new categories
        const { error: categoriesError } = await supabase
          .from('observation_categories')
          .insert(
            selectedCategories.map(categoryId => ({
              observation_id: id,
              category_id: categoryId
            }))
          );

        if (categoriesError) throw categoriesError;
      }

      toast.success('Report updated successfully');
      navigate('/');
    } catch (err) {
      console.error('Error updating report:', err);
      toast.error('Failed to update report');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <lucide.Loader2 className="h-8 w-8 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-6">
          <div className="text-center">
            <lucide.AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Report</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="text-green-600 hover:text-green-700 font-medium flex items-center gap-2 mx-auto"
            >
              <lucide.ArrowLeft className="h-5 w-5" />
              Back to Reports
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <img src={safetyLogo} alt="Safety B Line by ASPC Logo" className="h-16 w-auto mb-2 sm:mb-0" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 text-center sm:text-left">
                Safety Observation Report
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <lucide.ArrowLeft className="h-5 w-5" />
                Back
              </button>
            </div>
          </div>
        </div>
        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 sm:px-4 sm:py-3 rounded-md text-sm sm:text-base">
            {error}
          </div>
        )}
        {mode === 'edit' ? (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-3 sm:p-6">
              {/* General Information */}
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-2">
                  <lucide.ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  <h2 className="text-base sm:text-lg md:text-2xl font-semibold text-gray-900">General Information</h2>
                </div>

                {/* Project & Company */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.Briefcase className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Project</label>
                    </div>
                    <select
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                    >
                      <option value="">Select Project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.Building2 className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Company</label>
                    </div>
                    <select
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                    >
                      <option value="">Select Company</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Submitter & Date/Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.UserCircle className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Submitter Name</label>
                    </div>
                    <input
                      type="text"
                      value={submitterName}
                      onChange={(e) => setSubmitterName(e.target.value)}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.Calendar className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Date</label>
                    </div>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.Clock className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Time</label>
                    </div>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                    />
                  </div>
                </div>

                {/* Department & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.Users2 className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Department</label>
                    </div>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.MapPin className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Location</label>
                    </div>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                    />
                  </div>
                </div>
              </div>

              {/* Observation Details */}
              <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-6">
                <div className="flex items-center gap-2">
                  <lucide.FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  <h2 className="text-base sm:text-lg md:text-2xl font-semibold text-gray-900">Observation Details</h2>
                </div>

                {/* Subject Type */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <lucide.Tag className="h-4 w-4 text-green-600" />
                    <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Subject</label>
                  </div>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as 'SOSV : Safety Observation Site Visit' | 'SOP' | 'RES')}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                  >
                    <option value="SOSV : Safety Observation Site Visit">Safety Observation Site Visit (SOSV)</option>
                    <option value="SOP">Standard Operating Procedure (SOP)</option>
                    <option value="RES">Risk Evaluation Sheet (RES)</option>
                  </select>
                </div>

                {/* Safety Categories */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <lucide.ShieldAlert className="h-4 w-4 text-green-600" />
                    <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Safety Categories</label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {safetyCategories.map(category => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleCategorySelect(category.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors text-sm sm:text-base ${
                          selectedCategories.includes(category.id)
                            ? 'bg-green-50 border-green-500 text-green-700'
                            : 'border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {selectedCategories.includes(category.id) ? (
                          <lucide.CheckSquare className="h-4 w-4" />
                        ) : (
                          <lucide.Square className="h-4 w-4" />
                        )}
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <lucide.FileText className="h-4 w-4 text-green-600" />
                    <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Description</label>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-sm sm:text-base"
                  />
                </div>

                {/* Report Group */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <lucide.Users className="h-4 w-4 text-green-600" />
                    <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Report Group</label>
                  </div>
                  <select
                    value={reportGroup}
                    onChange={(e) => setReportGroup(e.target.value)}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                  >
                    <option value="">Select Group</option>
                    <option value="finding">Finding</option>
                    <option value="positive">Positive</option>
                  </select>
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <lucide.AlertOctagon className="h-4 w-4 text-green-600" />
                    <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Consequences</label>
                  </div>
                  <select
                    value={consequences}
                    onChange={(e) => setConsequences(e.target.value)}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                  >
                    <option value="">Select Consequences</option>
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="major">Major</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <lucide.BarChart2 className="h-4 w-4 text-green-600" />
                    <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Likelihood</label>
                  </div>
                  <select
                    value={likelihood}
                    onChange={(e) => setLikelihood(e.target.value)}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                  >
                    <option value="">Select Likelihood</option>
                    <option value="unlikely">Unlikely</option>
                    <option value="possible">Possible</option>
                    <option value="likely">Likely</option>
                    <option value="very-likely">Very Likely</option>
                  </select>
                </div>
              </div>

              {/* Status */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <lucide.Activity className="h-4 w-4 text-green-600" />
                  <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Status</label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setStatus('open')}
                    className={`py-2 px-4 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                      status === 'open'
                        ? 'bg-green-50 border-green-500 text-green-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <lucide.CheckCircle className="h-4 w-4" />
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('closed')}
                    className={`py-2 px-4 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                      status === 'closed'
                        ? 'bg-gray-100 border-gray-500 text-gray-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <lucide.XCircle className="h-4 w-4" />
                    Closed
                  </button>
                </div>
              </div>

              {/* Image Upload */}
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-2">
                  <lucide.Image className="h-5 w-5 text-green-600" />
                  <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Supporting Image</label>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:border-gray-300 cursor-pointer"
                  >
                    Choose File
                  </label>
                  {imageFile && (
                    <span className="text-sm text-gray-500">{imageFile.name}</span>
                  )}
                </div>
                {imagePreview && (
                  <div className="mt-4">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-w-xs rounded-lg border border-gray-200"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-image.png';
                        console.error('Failed to load image:', report?.supporting_image);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Action Plan Section */}
              <div className="mt-8 bg-gray-50 p-6 rounded-lg">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <lucide.CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    <h2 className="text-base sm:text-lg md:text-2xl font-semibold text-gray-900">Action Plan Required?</h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActionPlanRequired('yes')}
                      className={`py-2 px-3 sm:px-4 rounded-lg border transition-colors text-sm sm:text-base ${
                        actionPlanRequired === 'yes'
                          ? 'bg-green-50 border-green-500 text-green-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionPlanRequired('no')}
                      className={`py-2 px-3 sm:px-4 rounded-lg border transition-colors text-sm sm:text-base ${
                        actionPlanRequired === 'no'
                          ? 'bg-green-50 border-green-500 text-green-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {/* Action Plan Form */}
                {actionPlanRequired === 'yes' && (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Action Description */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <lucide.FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                        <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Action</label>
                      </div>
                      <textarea
                        value={currentActionPlan.action}
                        onChange={(e) => setCurrentActionPlan({
                          ...currentActionPlan,
                          action: e.target.value
                        })}
                        placeholder="Enter a detailed description of the required action"
                        rows={4}
                        className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-sm sm:text-base"
                      />
                    </div>

                    {/* Action Plan Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button
                        type="button"
                        onClick={() => handleSaveActionPlan(false)}
                        className="flex-1 py-2 px-3 sm:px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <lucide.Save className="h-4 w-4 sm:h-5 sm:w-5" />
                        Save Action Plan
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveActionPlan(true)}
                        className="flex-1 py-2 px-3 sm:px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <lucide.Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                        Save & Add Another
                      </button>
                    </div>

                    {/* List of Saved Action Plans */}
                    {actionPlans.length > 0 && (
                      <div className="mt-6 sm:mt-8">
                        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">Saved Action Plans</h3>
                        <div className="space-y-4">
                          {actionPlans.map((plan, index) => (
                            <div
                              key={index}
                              className="bg-white p-3 sm:p-4 rounded-lg shadow mb-4"
                            >
                              {editingActionPlanIndex === index ? (
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">Action</label>
                                    <input
                                      type="text"
                                      value={editedActionPlan?.action || ''}
                                      onChange={(e) => setEditedActionPlan({ ...editedActionPlan!, action: e.target.value })}
                                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">Due Date</label>
                                    <input
                                      type="date"
                                      value={editedActionPlan?.due_date || ''}
                                      onChange={(e) => setEditedActionPlan({ ...editedActionPlan!, due_date: e.target.value })}
                                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">Responsible Person</label>
                                    <input
                                      type="text"
                                      value={editedActionPlan?.responsible_person || ''}
                                      onChange={(e) => setEditedActionPlan({ ...editedActionPlan!, responsible_person: e.target.value })}
                                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">Follow-up Contact</label>
                                    <input
                                      type="text"
                                      value={editedActionPlan?.follow_up_contact || ''}
                                      onChange={(e) => setEditedActionPlan({ ...editedActionPlan!, follow_up_contact: e.target.value })}
                                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">Supporting Image</label>
                                    <div className="flex items-center gap-4 mt-1">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleEditedActionPlanImageChange}
                                        className="hidden"
                                        id={`edit-action-plan-image-${index}`}
                                      />
                                      <label
                                        htmlFor={`edit-action-plan-image-${index}`}
                                        className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:border-gray-300 cursor-pointer"
                                      >
                                        Choose File
                                      </label>
                                      {editedActionPlanImageFile && (
                                        <span className="text-sm text-gray-500">{editedActionPlanImageFile.name}</span>
                                      )}
                                    </div>
                                    {(editedActionPlanImagePreview || editedActionPlan?.supporting_image) && (
                                      <div className="mt-4">
                                        <img
                                          src={editedActionPlanImagePreview || `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/action-plan-images/${editedActionPlan?.supporting_image}`}
                                          alt="Preview"
                                          className="max-w-xs rounded-lg border border-gray-200"
                                        />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex justify-end space-x-2">
                                    <button
                                      onClick={handleCancelEditActionPlan}
                                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={handleSaveEditedActionPlan}
                                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                    >
                                      Save Changes
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <p className="font-medium text-sm sm:text-base">Action: {plan.action}</p>
                                  <p className="text-sm sm:text-base">Due Date: {plan.due_date}</p>
                                  <p className="text-sm sm:text-base">Responsible Person: {plan.responsible_person}</p>
                                  <p className="text-sm sm:text-base">Follow-up Contact: {plan.follow_up_contact}</p>
                                  <p className="text-sm sm:text-base">Status: {plan.status}</p>
                                  {plan.supporting_image && (
                                    <div className="mt-2">
                                      <img
                                        src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/action-plan-images/${plan.supporting_image}`}
                                        alt="Action plan supporting image"
                                        className="max-w-full h-auto rounded-lg"
                                        loading="lazy"
                                        onError={(e) => {
                                          e.currentTarget.src = '/placeholder-image.png';
                                          console.error('Failed to load image:', plan.supporting_image);
                                        }}
                                      />
                                    </div>
                                  )}
                                  <div className="mt-4 flex justify-end space-x-2">
                                    <button
                                      onClick={() => handleEditActionPlan(index)}
                                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleDeleteActionPlan(index);
                                      }}
                                      type="button"
                                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="mt-6 sm:mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {saving ? (
                    <lucide.Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  ) : (
                    <>
                      <lucide.Save className="h-4 w-4 sm:h-5 sm:w-5" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-3 sm:p-6">
              {/* General Information */}
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-2">
                  <lucide.ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  <h2 className="text-base sm:text-lg md:text-2xl font-semibold text-gray-900">General Information</h2>
                </div>

                {/* Project & Company */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.Briefcase className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Project</label>
                    </div>
                    <div className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-50 rounded-lg text-sm sm:text-base">
                      {projects.find(p => p.id === project)?.name || ''}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.Building2 className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Company</label>
                    </div>
                    <div className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-50 rounded-lg text-sm sm:text-base">
                      {companies.find(c => c.id === company)?.name || ''}
                    </div>
                  </div>
                </div>

                {/* Submitter & Date/Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.UserCircle className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Submitter Name</label>
                    </div>
                    <div className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-50 rounded-lg text-sm sm:text-base">
                      {submitterName}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.Calendar className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Date</label>
                    </div>
                    <div className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-50 rounded-lg text-sm sm:text-base">
                      {date}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.Clock className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Time</label>
                    </div>
                    <div className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-50 rounded-lg text-sm sm:text-base">
                      {time}
                    </div>
                  </div>
                </div>

                {/* Department & Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.Users2 className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Department</label>
                    </div>
                    <div className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-50 rounded-lg text-sm sm:text-base">
                      {department}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.MapPin className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Location</label>
                    </div>
                    <div className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-50 rounded-lg text-sm sm:text-base">
                      {location}
                    </div>
                  </div>
                </div>
              </div>

              {/* Observation Details */}
              <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-6">
                <div className="flex items-center gap-2">
                  <lucide.FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  <h2 className="text-base sm:text-lg md:text-2xl font-semibold text-gray-900">Observation Details</h2>
                </div>

                {/* Subject Type */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <lucide.Tag className="h-4 w-4 text-green-600" />
                    <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Subject</label>
                  </div>
                  <div className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-50 rounded-lg text-sm sm:text-base">
                    {subject}
                  </div>
                </div>

                {/* Safety Categories */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <lucide.ShieldAlert className="h-4 w-4 text-green-600" />
                    <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Safety Categories</label>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {safetyCategories
                      .filter(cat => selectedCategories.includes(cat.id))
                      .map(cat => (
                        <span
                          key={cat.id}
                          className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium bg-green-100 text-green-800"
                        >
                          <lucide.Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          {cat.name}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <lucide.FileText className="h-4 w-4 text-green-600" />
                    <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Description</label>
                  </div>
                  <div className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-50 rounded-lg whitespace-pre-wrap text-sm sm:text-base">
                    {description}
                  </div>
                </div>

                {/* Report Group */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <lucide.Users className="h-4 w-4 text-green-600" />
                    <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Report Group</label>
                  </div>
                  <div className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-50 rounded-lg text-sm sm:text-base">
                    {reportGroup}
                  </div>
                </div>
              </div>

              {/* Risk Assessment */}
              <div className="mt-8 space-y-6">
                <div className="flex items-center gap-2">
                  <lucide.AlertTriangle className="h-5 w-5 text-green-600" />
                  <h2 className="text-base sm:text-lg md:text-2xl font-semibold text-gray-900">Risk Assessment</h2>
                </div>

                {/* Consequences & Likelihood */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.AlertTriangle className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Consequences</label>
                    </div>
                    <div className="px-4 py-2 bg-gray-50 rounded-lg text-sm sm:text-base">
                      {consequences}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <lucide.BarChart2 className="h-4 w-4 text-green-600" />
                      <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Likelihood</label>
                    </div>
                    <div className="px-4 py-2 bg-gray-50 rounded-lg text-sm sm:text-base">
                      {likelihood}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <lucide.Activity className="h-4 w-4 text-green-600" />
                    <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Status</label>
                  </div>
                  <div className={`inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${
                    status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {status === 'open' ? (
                      <lucide.CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    ) : (
                      <lucide.XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    )}
                    {status}
                  </div>
                </div>
              </div>

              {/* Supporting Image */}
              {(imagePreview || report?.supporting_image) && (
                <div className="mt-6 sm:mt-8 space-y-4">
                  <div className="flex items-center gap-2">
                    <lucide.Image className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Supporting Image</label>
                  </div>
                  <div className="mt-4">
                    <img
                      src={imagePreview || `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/safety-images/${report?.supporting_image}`}
                      alt="Preview"
                      className="max-w-full h-auto rounded-lg border border-gray-200"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-image.png';
                        console.error('Failed to load image:', report?.supporting_image);
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Action Plans */}
              {actionPlans.length > 0 && (
                <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-6">
                  <div className="flex items-center gap-2">
                    <lucide.CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    <h2 className="text-base sm:text-lg md:text-2xl font-semibold text-gray-900">Action Plans</h2>
                  </div>
                  <div className="space-y-4">
                    {actionPlans.map((plan, index) => (
                      <div key={index} className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <lucide.FileText className="h-4 w-4 text-green-600" />
                              <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Action</label>
                            </div>
                            <div className="mt-1 text-sm sm:text-base">{plan.action}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <lucide.Calendar className="h-4 w-4 text-green-600" />
                              <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Due Date</label>
                            </div>
                            <div className="mt-1 text-sm sm:text-base">{plan.due_date}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <lucide.User className="h-4 w-4 text-green-600" />
                              <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Responsible Person</label>
                            </div>
                            <div className="mt-1 text-sm sm:text-base">{plan.responsible_person}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <lucide.UserCheck className="h-4 w-4 text-green-600" />
                              <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Follow-up Contact</label>
                            </div>
                            <div className="mt-1 text-sm sm:text-base">{plan.follow_up_contact}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <lucide.Activity className="h-4 w-4 text-green-600" />
                              <label className="text-xs sm:text-sm md:text-base font-medium text-gray-700">Status</label>
                            </div>
                            <div className={`mt-1 inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium ${
                              plan.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {plan.status === 'open' ? (
                                <lucide.CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              ) : (
                                <lucide.XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              )}
                              {plan.status}
                            </div>
                          </div>
                        </div>
                        {plan.supporting_image && (
                          <div className="mt-4">
                            <img
                              src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/action-plan-images/${plan.supporting_image}`}
                              alt="Action plan supporting image"
                              className="max-w-full h-auto rounded-lg"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder-image.png';
                                console.error('Failed to load image:', plan.supporting_image);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}