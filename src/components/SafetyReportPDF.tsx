import React, { useState, useEffect, useMemo } from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { format } from 'date-fns';
import type { SafetyCategory, Project, Company, ActionPlan } from '../lib/types';

// Register fonts
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/helvetica@4.5.0/files/helvetica-regular.woff2' },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/helvetica@4.5.0/files/helvetica-bold.woff2', fontWeight: 'bold' }
  ]
});

// Add image cache with TTL (Time To Live)
const imageCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface ImageUrls {
  main?: string;
  [key: string]: string | undefined;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 12,
    lineHeight: 1.5
  },
  header: {
    marginBottom: 20,
    borderBottom: 1,
    borderBottomColor: '#234CAD',
    paddingBottom: 10
  },
  headerTitle: {
    fontSize: 28,
    color: '#234CAD',
    marginBottom: 8,
    fontWeight: 'bold'
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666'
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#F8F9FB',
    padding: 15,
    borderRadius: 4
  },
  sectionTitle: {
    fontSize: 16,
    color: '#234CAD',
    marginBottom: 10,
    fontWeight: 'bold'
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5
  },
  infoItem: {
    width: '50%',
    marginBottom: 8
  },
  label: {
    color: '#666666',
    marginBottom: 2,
    fontSize: 10
  },
  value: {
    color: '#000000',
    fontSize: 12
  },
  description: {
    color: '#000000',
    lineHeight: 1.6
  },
  statusBadge: {
    backgroundColor: '#E5E7EB',
    padding: '4 8',
    borderRadius: 4,
    alignSelf: 'flex-start'
  },
  statusText: {
    fontSize: 12,
    color: '#374151'
  },
  actionPlanItem: {
    marginBottom: 8,
    paddingLeft: 10,
    borderLeft: 1,
    borderLeftColor: '#234CAD'
  },
  categoryTag: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
    padding: '4 8',
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 4,
    fontSize: 10
  },
  image: {
    width: 400,
    height: 300,
    marginTop: 10,
    marginBottom: 10,
    objectFit: 'contain'
  },
  imagePlaceholder: {
    width: 400,
    height: 300,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: '#E5E7EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  imageContainer: {
    marginTop: 10,
    marginBottom: 10,
    alignItems: 'center'
  }
});

interface SafetyReportPDFProps {
  report: {
    project: Project;
    company: Company;
    submitterName: string;
    date: string;
    time: string;
    department: string;
    location: string;
    description: string;
    reportGroup: string;
    consequences: string;
    likelihood: string;
    status: string;
    subject: string;
    supportingImage?: string;
    categories: SafetyCategory[];
    actionPlans: (ActionPlan & {
      supporting_image?: string;
    })[];
  };
}

export function SafetyReportPDF({ report }: SafetyReportPDFProps) {
  const [imageUrls, setImageUrls] = useState<ImageUrls>({});

  // Memoize the formatted date and time
  const formattedDate = useMemo(() => 
    format(new Date(), 'MMMM d, yyyy'), 
    []
  );

  // Memoize the report date
  const formattedReportDate = useMemo(() => 
    format(new Date(report.date), 'MMMM d, yyyy'),
    [report.date]
  );

  // Memoize the action plans with formatted dates
  const formattedActionPlans = useMemo(() => 
    report.actionPlans.map(plan => ({
      ...plan,
      formattedDueDate: format(new Date(plan.due_date), 'MMMM d, yyyy')
    })),
    [report.actionPlans]
  );

  useEffect(() => {
    const loadImages = async () => {
      const urls: ImageUrls = {};
      
      // Load main image
      if (report.supportingImage) {
        const mainImageUrl = await loadImage(report.supportingImage, false);
        if (mainImageUrl) {
          urls.main = mainImageUrl;
        }
      }

      // Load action plan images
      for (const plan of report.actionPlans) {
        if (plan.supporting_image && plan.id) {
          const planImageUrl = await loadImage(plan.supporting_image, true);
          if (planImageUrl) {
            urls[plan.id] = planImageUrl;
          }
        }
      }

      setImageUrls(urls);
    };

    loadImages();
  }, [report]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return { bg: '#DCFCE7', text: '#166534' };
      case 'closed':
        return { bg: '#FEE2E2', text: '#991B1B' };
      default:
        return { bg: '#E5E7EB', text: '#374151' };
    }
  };

  const getConsequencesColor = (consequences: string) => {
    switch (consequences.toLowerCase()) {
      case 'severe':
        return { bg: '#FEE2E2', text: '#991B1B' };
      case 'major':
        return { bg: '#FFEDD5', text: '#9A3412' };
      case 'moderate':
        return { bg: '#FEF9C3', text: '#854D0E' };
      case 'minor':
        return { bg: '#DCFCE7', text: '#166534' };
      default:
        return { bg: '#E5E7EB', text: '#374151' };
    }
  };

  const statusColors = getStatusColor(report.status);
  const consequencesColors = getConsequencesColor(report.consequences);

  const loadImage = async (url: string, isActionPlan: boolean): Promise<string | null> => {
    try {
      // Check cache first
      const cachedImage = imageCache.get(url);
      if (cachedImage && Date.now() - cachedImage.timestamp < CACHE_TTL) {
        return cachedImage.url;
      }

      let imageUrl = url;
      
      // Handle base64 images
      if (url.startsWith('data:image')) {
        return url;
      }

      // Handle full URLs
      if (url.startsWith('http')) {
        imageUrl = url;
      } else {
        // Construct Supabase URL with correct bucket
        const bucket = isActionPlan ? 'action-plan-images' : 'safety-images';
        imageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${url}`;
      }

      // Fetch and cache the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to load image: ${response.statusText}`);
      }

      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      // Cache the result with timestamp
      imageCache.set(url, { url: base64, timestamp: Date.now() });
      return base64;
    } catch (error) {
      console.error('Error loading image:', error);
      return null;
    }
  };

  const renderImage = (url: string, isActionPlan: boolean = false) => {
    const imageUrl = url ? imageUrls[url] : imageUrls.main;
    
    if (!imageUrl) {
      return (
        <View style={styles.imageContainer}>
          <View style={styles.imagePlaceholder}>
            <Text style={{ color: '#666666', fontSize: 10 }}>Image not available</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.imageContainer}>
        <Image
          src={imageUrl}
          style={styles.image}
          cache={false}
        />
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Safety Report</Text>
          <Text style={styles.headerSubtitle}>
            Generated on {formattedDate} at {report.time}
          </Text>
        </View>

        {/* General Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Information</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Project</Text>
              <Text style={styles.value}>{report.project.name}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Company</Text>
              <Text style={styles.value}>{report.company.name}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Submitter Name</Text>
              <Text style={styles.value}>{report.submitterName}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{formattedReportDate}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Time</Text>
              <Text style={styles.value}>{report.time}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Department</Text>
              <Text style={styles.value}>{report.department}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Location</Text>
              <Text style={styles.value}>{report.location}</Text>
            </View>
          </View>
        </View>

        {/* Observation Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observation Details</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Subject</Text>
              <Text style={styles.value}>{report.subject}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Report Group</Text>
              <Text style={styles.value}>{report.reportGroup}</Text>
            </View>
          </View>

          {/* Safety Categories */}
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>Safety Categories</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
              {report.categories.map((category) => (
                <Text key={category.id} style={styles.categoryTag}>
                  {category.name}
                </Text>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>Description</Text>
            <Text style={[styles.value, { marginTop: 4 }]}>{report.description}</Text>
          </View>
        </View>

        {/* Risk Assessment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk Assessment</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Consequences</Text>
              <Text style={[styles.value, { color: consequencesColors.text }]}>
                {report.consequences}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Likelihood</Text>
              <Text style={styles.value}>{report.likelihood}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Status</Text>
              <Text style={[styles.value, { color: statusColors.text }]}>
                {report.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Supporting Image Section */}
        {report.supportingImage && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Supporting Image</Text>
            {renderImage(report.supportingImage)}
          </View>
        )}

        {/* Action Plans Section */}
        {report.actionPlans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Action Plans</Text>
            {formattedActionPlans.map((plan) => (
              <View key={plan.id} style={styles.actionPlanItem}>
                <Text style={styles.value}>{plan.action}</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.label}>Due Date</Text>
                    <Text style={styles.value}>{plan.formattedDueDate}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.label}>Responsible Person</Text>
                    <Text style={styles.value}>{plan.responsible_person}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.label}>Follow-up Contact</Text>
                    <Text style={styles.value}>{plan.follow_up_contact}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.label}>Status</Text>
                    <Text style={[styles.value, { color: getStatusColor(plan.status).text }]}>
                      {plan.status}
                    </Text>
                  </View>
                </View>
                {plan.supporting_image && renderImage(plan.supporting_image, true)}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
} 