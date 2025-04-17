import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as lucide from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SafetyCategories } from '../components/SafetyCategories';
import { SafetyReportsTable } from '../components/SafetyReportsTable';
import toast from 'react-hot-toast';
import type { SafetyCategory, Project, Company } from '../lib/types';

interface ActionPlan {
  action: string;
  dueDate: string;
  responsiblePerson: string;
  followUpContact: string;
  status: 'open' | 'closed';
  supporting_image?: string;
}

interface ValidationErrors {
  [key: string]: string;
}

interface SafetyReportProps {
  mode?: 'create' | 'view';
}

export function SafetyReport({ mode = 'view' }: SafetyReportProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [currentActionPlan, setCurrentActionPlan] = useState<ActionPlan>({
    action: '',
    dueDate: '',
    responsiblePerson: '',
    followUpContact: '',
    status: 'open'
  });
  const [actionPlanRequired, setActionPlanRequired] = useState('no');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [subject, setSubject] = useState<'SOR' | 'SOP' | 'RES'>('SOR');
  
  // Form state
  const [project, setProject] = useState('');
  const [company, setCompany] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 5));
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [reportGroup, setReportGroup] = useState('');
  const [consequences, setConsequences] = useState('');
  const [likelihood, setLikelihood] = useState('');
  const [status, setStatus] = useState('open');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [safetyCategories, setSafetyCategories] = useState<SafetyCategory[]>([]);
  
  // Add new state for projects and companies
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId) 
        : [...prev, categoryId]
    );
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Load projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name');
      
      if (projectsError) throw projectsError;
      setProjects(projectsData);

      // Load companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name');
      
      if (companiesError) throw companiesError;
      setCompanies(companiesData);

      // Load safety categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('safety_categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;
      setSafetyCategories(categoriesData);

    } catch (err) {
      console.error('Error loading initial data:', err);
      toast.error('Failed to load form data');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const errors: ValidationErrors = {};

    // Required field validation
    if (!project) errors.project = 'Project is required';
    if (!company) errors.company = 'Company is required';
    if (!submitterName) errors.submitterName = 'Submitter name is required';
    if (!date) errors.date = 'Date is required';
    if (!time) errors.time = 'Time is required';
    if (!location) errors.location = 'Location is required';
    if (!description) errors.description = 'Description is required';
    if (!reportGroup) errors.reportGroup = 'Report group is required';
    if (!consequences) errors.consequences = 'Consequences is required';
    if (!likelihood) errors.likelihood = 'Likelihood is required';
    if (!subject) errors.subject = 'Subject is required';
    if (selectedCategories.length === 0) errors.categories = 'At least one safety category is required';

    // Action plan validation
    if (actionPlanRequired === 'yes' && actionPlans.length === 0) {
      errors.actionPlans = 'At least one action plan is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveActionPlan = async (addAnother: boolean) => {
    if (!currentActionPlan.action || 
        !currentActionPlan.dueDate || 
        !currentActionPlan.responsiblePerson || 
        !currentActionPlan.followUpContact) {
      toast.error('Please fill in all action plan fields');
      return;
    }

    setActionPlans([...actionPlans, currentActionPlan]);
    toast.success('Action plan saved');

    if (addAnother) {
      setCurrentActionPlan({
        action: '',
        dueDate: '',
        responsiblePerson: '',
        followUpContact: '',
        status: 'open'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Upload image if exists
      let imagePath = '';
      if (imageFile) {
        const { data: imageData, error: imageError } = await supabase.storage
          .from('safety-images')
          .upload(`${Date.now()}-${imageFile.name}`, imageFile);

        if (imageError) throw imageError;
        imagePath = imageData.path;
      }

      // Save observation
      const { data: savedReport, error: observationError } = await supabase
        .from('observation_details')
        .insert({
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
          corrective_action: actionPlans.length > 0,
          supporting_image: imagePath || null,
          created_by: user.id
        })
        .select()
        .single();

      if (observationError) {
        console.error('Observation Error:', observationError);
        throw new Error('Failed to save observation');
      }

      if (!savedReport) {
        throw new Error('No report data returned after save');
      }

      // Save selected categories
      if (selectedCategories.length > 0) {
        const { error: categoriesError } = await supabase
          .from('observation_categories')
          .insert(
            selectedCategories.map(categoryId => ({
              observation_id: savedReport.id,
              category_id: categoryId
            }))
          );

        if (categoriesError) {
          console.error('Categories Error:', categoriesError);
          throw new Error('Failed to save categories');
        }
      }

      // Save action plans if any
      if (actionPlans.length > 0) {
        const { error: actionPlansError } = await supabase
          .from('action_plans')
          .insert(
            actionPlans.map(plan => ({
              observation_id: savedReport.id,
              action: plan.action,
              due_date: plan.dueDate,
              responsible_person: plan.responsiblePerson,
              follow_up_contact: plan.followUpContact,
              status: plan.status,
              created_by: user.id
            }))
          );

        if (actionPlansError) {
          console.error('Action Plans Error:', actionPlansError);
          throw new Error('Failed to save action plans');
        }
      }

      toast.success('Safety report saved successfully!');
      navigate(`/reports/${savedReport.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save report';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Save Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <lucide.Loader2 className="h-8 w-8 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading form data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <lucide.Shield className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Safety Observation Report</h1>
          </div>
          <button
            onClick={() => signOut()}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-2"
          >
            <lucide.LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {mode === 'create' ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              {/* General Information Section */}
              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">General Information</h2>
                <div className="grid grid-cols-2 gap-6">
                  {/* Project */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <lucide.Briefcase className="h-5 w-5 text-green-600" />
                      <label className="text-sm font-medium text-gray-700">Project</label>
                    </div>
                    <select 
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                      required
                      className={`select-field ${validationErrors.project ? 'border-red-500' : ''}`}
                    >
                      <option value="">Select Project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {validationErrors.project && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.project}</p>
                    )}
                  </div>

                  {/* Company */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <lucide.Building2 className="h-5 w-5 text-green-600" />
                      <label className="text-sm font-medium text-gray-700">Company</label>
                    </div>
                    <select 
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      required
                      className={`select-field ${validationErrors.company ? 'border-red-500' : ''}`}
                    >
                      <option value="">Select Company</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {validationErrors.company && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.company}</p>
                    )}
                  </div>

                  {/* Submitter Name */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <lucide.UserCircle className="h-5 w-5 text-green-600" />
                      <label className="text-sm font-medium text-gray-700">Submitter Name</label>
                    </div>
                    <input
                      type="text"
                      value={submitterName}
                      onChange={(e) => setSubmitterName(e.target.value)}
                      placeholder="Enter your name"
                      required
                      className={`w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                        validationErrors.submitterName ? 'border-red-500' : ''
                      }`}
                    />
                    {validationErrors.submitterName && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.submitterName}</p>
                    )}
                  </div>

                  {/* Date and Time */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <lucide.Calendar className="h-5 w-5 text-green-600" />
                      <label className="text-sm font-medium text-gray-700">Date & Time</label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        className={`w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                          validationErrors.date ? 'border-red-500' : ''
                        }`}
                      />
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        required
                        className={`w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                          validationErrors.time ? 'border-red-500' : ''
                        }`}
                      />
                    </div>
                    {(validationErrors.date || validationErrors.time) && (
                      <p className="text-red-500 text-sm mt-1">
                        {validationErrors.date || validationErrors.time}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Observation Details Section */}
              <div className="bg-gray-50 p-6 rounded-lg mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Observation Details</h2>

                {/* Subject Type */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-2">
                    <lucide.FileText className="h-5 w-5 text-green-600" />
                    <label className="text-sm font-medium text-gray-700">Subject</label>
                  </div>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value as 'SOR' | 'SOP' | 'RES')}
                    required
                    className={`select-field ${validationErrors.subject ? 'border-red-500' : ''}`}
                  >
                    <option value="">Select Subject</option>
                    <option value="SOR">Safety Observation Report (SOR)</option>
                    <option value="SOP">Standard Operating Procedure (SOP)</option>
                    <option value="RES">Risk Evaluation Sheet (RES)</option>
                  </select>
                  {validationErrors.subject && (
                    <p className="text-red-500 text-sm">{validationErrors.subject}</p>
                  )}
                </div>

                {/* Safety Categories */}
                <div className="mb-6">
                  <SafetyCategories
                    selectedCategories={selectedCategories}
                    onSelectCategory={handleCategorySelect}
                    categories={safetyCategories}
                    error={validationErrors.categories}
                  />
                </div>

                {/* Location */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-2">
                    <lucide.MapPin className="h-5 w-5 text-green-600" />
                    <label className="text-sm font-medium text-gray-700">Location</label>
                  </div>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter location"
                    required
                    className={`w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                      validationErrors.location ? 'border-red-500' : ''
                    }`}
                  />
                  {validationErrors.location && (
                    <p className="text-red-500 text-sm">{validationErrors.location}</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-2">
                    <lucide.FileText className="h-5 w-5 text-green-600" />
                    <label className="text-sm font-medium text-gray-700">Description</label>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the safety observation"
                    required
                    rows={4}
                    className={`w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none ${
                      validationErrors.description ? 'border-red-500' : ''
                    }`}
                  />
                  {validationErrors.description && (
                    <p className="text-red-500 text-sm">{validationErrors.description}</p>
                  )}
                </div>

                {/* Report Group */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-2">
                    <lucide.Users className="h-5 w-5 text-green-600" />
                    <label className="text-sm font-medium text-gray-700">Report Group</label>
                  </div>
                  <select
                    value={reportGroup}
                    onChange={(e) => setReportGroup(e.target.value)}
                    required
                    className={`select-field ${validationErrors.reportGroup ? 'border-red-500' : ''}`}
                  >
                    <option value="">Select Group</option>
                    <option value="operations">Operations</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="safety">Safety</option>
                    <option value="contractors">Contractors</option>
                  </select>
                  {validationErrors.reportGroup && (
                    <p className="text-red-500 text-sm">{validationErrors.reportGroup}</p>
                  )}
                </div>

                {/* Risk Assessment */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  {/* Potential Consequences */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <lucide.AlertTriangle className="h-5 w-5 text-green-600" />
                      <label className="text-sm font-medium text-gray-700">Potential Consequences</label>
                    </div>
                    <select
                      value={consequences}
                      onChange={(e) => setConsequences(e.target.value)}
                      required
                      className={`select-field ${validationErrors.consequences ? 'border-red-500' : ''}`}
                    >
                      <option value="">Select Consequences</option>
                      <option value="minor">Minor</option>
                      <option value="moderate">Moderate</option>
                      <option value="major">Major</option>
                      <option value="severe">Severe</option>
                    </select>
                    {validationErrors.consequences && (
                      <p className="text-red-500 text-sm">{validationErrors.consequences}</p>
                    )}
                  </div>

                  {/* Likelihood */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <lucide.BarChart2 className="h-5 w-5 text-green-600" />
                      <label className="text-sm font-medium text-gray-700">Likelihood</label>
                    </div>
                    <select
                      value={likelihood}
                      onChange={(e) => setLikelihood(e.target.value)}
                      required
                      className={`select-field ${validationErrors.likelihood ? 'border-red-500' : ''}`}
                    >
                      <option value="">Select Likelihood</option>
                      <option value="unlikely">Unlikely</option>
                      <option value="possible">Possible</option>
                      <option value="likely">Likely</option>
                      <option value="very-likely">Very Likely</option>
                    </select>
                    {validationErrors.likelihood && (
                      <p className="text-red-500 text-sm">{validationErrors.likelihood}</p>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-2">
                    <lucide.Activity className="h-5 w-5 text-green-600" />
                    <label className="text-sm font-medium text-gray-700">Status</label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setStatus('open')}
                      className={`py-2 px-4 rounded-lg border transition-colors ${
                        status === 'open'
                          ? 'bg-green-50 border-green-500 text-green-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('closed')}
                      className={`py-2 px-4 rounded-lg border transition-colors ${
                        status === 'closed'
                          ? 'bg-gray-50 border-gray-500 text-gray-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Closed
                    </button>
                  </div>
                </div>

                {/* Image Upload */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <lucide.Image className="h-5 w-5 text-green-600" />
                    <label className="text-sm font-medium text-gray-700">Supporting Image</label>
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
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Plan Section */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <lucide.CheckSquare className="h-5 w-5 text-green-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Action Plan Required?</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setActionPlanRequired('yes')}
                      className={`py-2 px-4 rounded-lg border transition-colors ${
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
                      className={`py-2 px-4 rounded-lg border transition-colors ${
                        actionPlanRequired === 'no'
                          ? 'bg-green-50 border-green-500 text-green-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {actionPlanRequired === 'yes' && (
                  <div className="space-y-6">
                    {/* Action Description */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <lucide.FileText className="h-5 w-5 text-green-600" />
                        <label className="text-sm font-medium text-gray-700">Action</label>
                      </div>
                      <textarea
                        value={currentActionPlan.action}
                        onChange={(e) => setCurrentActionPlan({
                          ...currentActionPlan,
                          action: e.target.value
                        })}
                        placeholder="Enter a detailed description of the required action"
                        rows={4}
                        required
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                      />
                    </div>

                    {/* Due Date */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <lucide.Calendar className="h-5 w-5 text-green-600" />
                        <label className="text-sm font-medium text-gray-700">Due Date</label>
                      </div>
                      <input
                        type="date"
                        value={currentActionPlan.dueDate}
                        onChange={(e) => setCurrentActionPlan({
                          ...currentActionPlan,
                          dueDate: e.target.value
                        })}
                        min={new Date().toISOString().split('T')[0]}
                        required
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    {/* Responsible Person */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <lucide.User className="h-5 w-5 text-green-600" />
                        <label className="text-sm font-medium text-gray-700">Responsible Person</label>
                      </div>
                      <input
                        type="text"
                        value={currentActionPlan.responsiblePerson}
                        onChange={(e) => setCurrentActionPlan({
                          ...currentActionPlan,
                          responsiblePerson: e.target.value
                        })}
                        placeholder="Enter name of person responsible"
                        required
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    {/* Follow-up Contact */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <lucide.UserCheck className="h-5 w-5 text-green-600" />
                        <label className="text-sm font-medium text-gray-700">Follow-up Contact</label>
                      </div>
                      <input
                        type="text"
                        value={currentActionPlan.followUpContact}
                        onChange={(e) => setCurrentActionPlan({
                          ...currentActionPlan,
                          followUpContact: e.target.value
                        })}
                        placeholder="Enter name of person monitoring progress"
                        required
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    {/* Action Plan Buttons */}
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => handleSaveActionPlan(false)}
                        className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <lucide.Save className="h-5 w-5" />
                        Save Action Plan
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveActionPlan(true)}
                        className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <lucide.Plus className="h-5 w-5" />
                        Save & Add Another
                      </button>
                    </div>

                    {/* List of Saved Action Plans */}
                    {actionPlans.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Saved Action Plans</h3>
                        <div className="space-y-4">
                          {actionPlans.map((plan, index) => (
                            <div
                              key={index}
                              className="p-4 border border-gray-200 rounded-lg"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium text-gray-900">Action Plan #{index + 1}</h4>
                                <span className={`px-2 py-1 rounded-full text-sm ${
                                  plan.status === 'open'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                                </span>
                              </div>
                              <p className="text-gray-600 mb-2">{plan.action}</p>
                              <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                                <div>Due Date: {plan.dueDate}</div>
                                <div>Responsible: {plan.responsiblePerson}</div>
                                <div>Follow-up: {plan.followUpContact}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <lucide.Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <lucide.Save className="h-5 w-5" />
                      Save Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <SafetyReportsTable />
        )}
      </div>
    </div>
  );
}