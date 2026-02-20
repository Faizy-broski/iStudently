"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Award, 
  Users, 
  Search, 
  Loader2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Maximize2,
  Code,
  Printer,
  Settings,
  Type,
  Info,
  ChevronLeft,
  ChevronRight,
  Copy,
  ClipboardPaste,
} from "lucide-react";
import { toast } from "sonner";
import { useCampus } from "@/context/CampusContext";
import { useGradeLevels, useSections } from "@/hooks/useAcademics";
import { getStudents, Student } from "@/lib/api/students";

// Utility function for debouncing
function debounce(
  func: (content: string) => void,
  wait: number
): ((content: string) => void) & { cancel: () => void } {
  let timeout: NodeJS.Timeout;
  
  const debounced = (content: string) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(content), wait);
  };
  
  debounced.cancel = () => {
    clearTimeout(timeout);
  };
  
  return debounced;
}

// Available placeholder fields for certificates — same as ID card + certificate-specific
const PLACEHOLDER_FIELDS = [
  // Personal Information
  { id: '__FULL_NAME__', label: 'Full Name', category: 'Personal' },
  { id: '__FIRST_NAME__', label: 'First Name', category: 'Personal' },
  { id: '__FATHER_NAME__', label: "Father's Name", category: 'Personal' },
  { id: '__GRANDFATHER_NAME__', label: "Grandfather's Name", category: 'Personal' },
  { id: '__LAST_NAME__', label: 'Last Name / Surname', category: 'Personal' },
  { id: '__DATE_OF_BIRTH__', label: 'Date of Birth', category: 'Personal' },
  { id: '__GENDER__', label: 'Gender', category: 'Personal' },
  { id: '__BLOOD_GROUP__', label: 'Blood Group', category: 'Personal' },
  
  // Contact Information
  { id: '__EMAIL__', label: 'Email', category: 'Contact' },
  { id: '__PHONE__', label: 'Phone', category: 'Contact' },
  { id: '__ADDRESS__', label: 'Address', category: 'Contact' },
  
  // Academic Information
  { id: '__STUDENT_ID__', label: 'Student ID', category: 'Academic' },
  { id: '__STUDENT_NUMBER__', label: 'Student Number', category: 'Academic' },
  { id: '__ADMISSION_NUMBER__', label: 'Admission Number', category: 'Academic' },
  { id: '__ROLL_NUMBER__', label: 'Roll Number', category: 'Academic' },
  { id: '__GRADE_LEVEL__', label: 'Grade Level', category: 'Academic' },
  { id: '__GRADE_ID__', label: 'Grade ID', category: 'Academic' },
  { id: '__SECTION__', label: 'Section', category: 'Academic' },
  { id: '__ADMISSION_DATE__', label: 'Admission Date', category: 'Academic' },
  
  // Parent/Guardian
  { id: '__PARENT_NAME__', label: 'Parent Name', category: 'Family' },
  { id: '__PARENT_PHONE__', label: 'Parent Phone', category: 'Family' },
  { id: '__EMERGENCY_CONTACT__', label: 'Emergency Contact', category: 'Family' },
  
  // School Information
  { id: '__SCHOOL_TITLE__', label: 'School Title', category: 'School' },
  { id: '__SCHOOL_PRINCIPAL__', label: 'School Principal', category: 'School' },
  { id: '__CAMPUS__', label: 'Campus Name', category: 'School' },
  { id: '__CAMPUS_ADDRESS__', label: 'Campus Address', category: 'School' },
  { id: '__CAMPUS_PHONE__', label: 'Campus Phone', category: 'School' },
  { id: '__SCHOOL_YEAR__', label: 'School Year', category: 'School' },
  
  // Media
  { id: '__PHOTO__', label: 'Student Photo', category: 'Media' },
  { id: '__SCHOOL_LOGO__', label: 'School Logo', category: 'Media' },
  
  // System
  { id: '__DATE__', label: 'Current Date', category: 'System' },
  { id: '__VALID_UNTIL__', label: 'Valid Until Date', category: 'System' },
];

// Group fields by category
const GROUPED_FIELDS = PLACEHOLDER_FIELDS.reduce((acc, field) => {
  if (!acc[field.category]) acc[field.category] = [];
  acc[field.category].push(field);
  return acc;
}, {} as Record<string, typeof PLACEHOLDER_FIELDS>);

// Default certificate template
const DEFAULT_TEMPLATE = `<div style="text-align: center; padding: 40px 20px;">
<p style="font-size: 28px; font-weight: bold; margin-bottom: 10px; color: #022172;">CERTIFICATE OF ENROLLMENT</p>
<p style="font-size: 16px; color: #666; margin-bottom: 30px;">__SCHOOL_TITLE__</p>
<hr style="border: 1px solid #022172; width: 60%; margin: 20px auto;" />
<p style="font-size: 16px; margin: 20px 0;">This is to certify that</p>
<p style="font-size: 24px; font-weight: bold; color: #022172; margin: 10px 0;">__FULL_NAME__</p>
<p style="font-size: 16px; margin: 20px 0;">is officially enrolled in <strong>Grade __GRADE_LEVEL__</strong>,<br/>Section <strong>__SECTION__</strong> for the school year <strong>__SCHOOL_YEAR__</strong>.</p>
<p style="font-size: 14px; color: #666; margin: 10px 0;">Student Number: __STUDENT_NUMBER__</p>
<p style="font-size: 14px; color: #666; margin: 10px 0;">Date of Birth: __DATE_OF_BIRTH__</p>
<div style="margin-top: 60px; display: flex; justify-content: space-around;">
  <div style="text-align: center;">
    <div style="border-top: 2px solid #333; width: 200px; margin: 0 auto;"></div>
    <p style="font-size: 14px; margin-top: 5px;">__SCHOOL_PRINCIPAL__</p>
    <p style="font-size: 12px; color: #666;">School Principal</p>
  </div>
  <div style="text-align: center;">
    <div style="border-top: 2px solid #333; width: 200px; margin: 0 auto;"></div>
    <p style="font-size: 14px; margin-top: 5px;">__DATE__</p>
    <p style="font-size: 12px; color: #666;">Date Issued</p>
  </div>
</div>
</div>`;

export default function CertificateEnrollmentPage() {
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;
  
  // State for filters
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // State for selections
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedField, setSelectedField] = useState<string>("");
  
  // Dialog states for link and image insertion
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageWidth, setImageWidth] = useState("");
  const [imageHeight, setImageHeight] = useState("");
  const [savedSelection, setSavedSelection] = useState<Range | null>(null);
  
  // State for template content
  const [templateContent, setTemplateContent] = useState<string>(DEFAULT_TEMPLATE);
  
  // State for data
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [studentsPerPage, setStudentsPerPage] = useState(10);
  
  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGeneratedCerts, setShowGeneratedCerts] = useState(false);
  
  // Certificate-specific settings
  const [hideHeaders, setHideHeaders] = useState(false);
  const [mailingLabels, setMailingLabels] = useState(false);
  
  // Design settings
  const [designSettings, setDesignSettings] = useState({
    backgroundImage: "",
    certificatePaddingTop: 20,
    certificatePaddingLeft: 20,
    fontSize: 14,
    textColor: "#000000",
    lineHeight: 1.6,
  });
  
  // Hooks for academics data
  const { gradeLevels } = useGradeLevels();
  const { sections } = useSections();
  
  // Editor ref
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Debounced content update
  const debouncedUpdateContent = useMemo(
    () => debounce((content: string) => {
      setTemplateContent(content);
    }, 300),
    []
  );
  
  // Initialize editor content once
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = templateContent || DEFAULT_TEMPLATE;
    }
  }, [templateContent]);
  
  // Cleanup debounced updates on unmount
  useEffect(() => {
    return () => {
      debouncedUpdateContent.cancel?.();
    };
  }, [debouncedUpdateContent]);
  
  // Filter sections by selected grade level
  const filteredSections = useMemo(() => {
    if (!selectedGradeLevel || selectedGradeLevel === 'all') return sections;
    return sections.filter(s => s.grade_level_id === selectedGradeLevel);
  }, [sections, selectedGradeLevel]);
  
  // Calculate limit based on filter selection
  const currentLimit = useMemo(() => {
    if (selectedGradeLevel !== 'all' || selectedSection !== 'all' || searchQuery) {
      return studentsPerPage;
    }
    return 10;
  }, [selectedGradeLevel, selectedSection, searchQuery, studentsPerPage]);
  
  // Load students when filters change
  useEffect(() => {
    const loadStudents = async () => {
      setLoadingStudents(true);
      try {
        const params = {
          page: currentPage,
          limit: currentLimit,
          search: searchQuery || undefined,
          grade_level: selectedGradeLevel !== 'all' ? selectedGradeLevel : undefined,
          campus_id: selectedCampus?.id
        };
        
        const response = await getStudents(params);
        
        if (response.success && response.data) {
          setStudents(response.data);
          setTotalStudents(response.pagination?.total || response.data.length);
        } else {
          if (response.error) {
            toast.error(`Failed to load students: ${response.error}`);
          } else {
            toast.error('Failed to load students');
          }
        }
      } catch {
        toast.error('Failed to load students');
      } finally {
        setLoadingStudents(false);
      }
    };
    
    const debounceTimer = setTimeout(loadStudents, 300);
    return () => clearTimeout(debounceTimer);
  }, [selectedGradeLevel, searchQuery, selectedCampus?.id, currentPage, currentLimit]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGradeLevel, selectedSection, searchQuery]);
  
  // Enable drag and drop for images in editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    let draggedImage: HTMLImageElement | null = null;

    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        draggedImage = target as HTMLImageElement;
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/html', target.outerHTML);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      if (!draggedImage) return;

      const selection = window.getSelection();
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      
      if (range && selection) {
        draggedImage.remove();
        selection.removeAllRanges();
        selection.addRange(range);
        range.insertNode(draggedImage);
        
        const newContent = editor.innerHTML;
        setTemplateContent(newContent);
      }
      
      draggedImage = null;
    };

    editor.addEventListener('dragstart', handleDragStart as EventListener);
    editor.addEventListener('dragover', handleDragOver as EventListener);
    editor.addEventListener('drop', handleDrop as EventListener);

    return () => {
      editor.removeEventListener('dragstart', handleDragStart as EventListener);
      editor.removeEventListener('dragover', handleDragOver as EventListener);
      editor.removeEventListener('drop', handleDrop as EventListener);
    };
  }, []);
  
  // Filter students by section
  const filteredStudents = useMemo(() => {
    if (!selectedSection || selectedSection === 'all') return students;
    return students.filter(s => {
      const studentWithSection = s as Student & { section_id?: string };
      return studentWithSection.section_id === selectedSection;
    });
  }, [students, selectedSection]);

  // Execute editor command
  const execCommand = useCallback((command: string, value?: string) => {
    try {
      if (editorRef.current) {
        editorRef.current.focus();
      }
      document.execCommand(command, false, value);
      if (editorRef.current) {
        const newContent = editorRef.current.innerHTML;
        setTemplateContent(newContent);
        debouncedUpdateContent(newContent);
      }
    } catch {
      toast.error('Text formatting failed');
    }
  }, [debouncedUpdateContent]);
  
  // Open link dialog
  const openLinkDialog = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      setSavedSelection(selection.getRangeAt(0).cloneRange());
    }
    setLinkUrl("");
    setLinkText("");
    setLinkDialogOpen(true);
  }, []);
  
  // Insert link
  const handleInsertLink = useCallback(() => {
    if (!linkUrl) {
      toast.error('Please enter a URL');
      return;
    }
    
    if (editorRef.current) {
      editorRef.current.focus();
      
      if (savedSelection) {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(savedSelection);
        }
      }
      
      const selection = window.getSelection();
      const selectedText = selection?.toString() || '';
      const displayText = linkText || selectedText || linkUrl;
      
      const linkHtml = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" style="color: blue; text-decoration: underline;">${displayText}</a>&nbsp;`;
      
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = linkHtml;
        const fragment = document.createDocumentFragment();
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }
        range.insertNode(fragment);
      }
      
      const newContent = editorRef.current.innerHTML;
      setTemplateContent(newContent);
    }
    
    setLinkDialogOpen(false);
    setLinkUrl("");
    setLinkText("");
    setSavedSelection(null);
    toast.success('Link inserted successfully');
  }, [linkUrl, linkText, savedSelection]);
  
  // Open image dialog
  const openImageDialog = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      setSavedSelection(selection.getRangeAt(0).cloneRange());
    }
    setImageUrl("");
    setImageAlt("");
    setImageFile(null);
    setImageWidth("");
    setImageHeight("");
    setImageDialogOpen(true);
  }, []);
  
  // Insert image
  const handleInsertImage = useCallback(() => {
    if (!imageUrl && !imageFile) {
      toast.error('Please enter an image URL or select a file');
      return;
    }
    
    const insertImageHtml = (src: string) => {
      if (editorRef.current) {
        editorRef.current.focus();
        
        if (savedSelection) {
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(savedSelection);
          }
        }
        
        let styleStr = 'max-width: 100%; cursor: move; display: inline-block;';
        if (imageWidth && imageHeight) {
          styleStr = `width: ${imageWidth}px; height: ${imageHeight}px; cursor: move; display: inline-block;`;
        } else if (imageWidth) {
          styleStr = `width: ${imageWidth}px; height: auto; cursor: move; display: inline-block;`;
        } else if (imageHeight) {
          styleStr = `width: auto; height: ${imageHeight}px; cursor: move; display: inline-block;`;
        }
        
        const imgHtml = `<img src="${src}" alt="${imageAlt || 'Image'}" draggable="true" style="${styleStr}" class="editable-image" />&nbsp;`;
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = imgHtml;
          const fragment = document.createDocumentFragment();
          while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
          }
          range.insertNode(fragment);
        }
        
        const newContent = editorRef.current.innerHTML;
        setTemplateContent(newContent);
        
        toast.success('Image inserted successfully');
      }
    };
    
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        insertImageHtml(dataUrl);
      };
      reader.readAsDataURL(imageFile);
    } else if (imageUrl) {
      insertImageHtml(imageUrl);
    }
    
    setImageDialogOpen(false);
    setImageUrl("");
    setImageAlt("");
    setImageFile(null);
    setImageWidth("");
    setImageHeight("");
    setSavedSelection(null);
  }, [imageUrl, imageAlt, imageFile, imageWidth, imageHeight, savedSelection]);
  
  // Change text color
  const changeTextColor = useCallback((color: string) => {
    const colorMap: Record<string, string> = {
      'black': '#000000',
      'red': '#FF0000',
      'blue': '#0000FF',
      'green': '#008000',
      'orange': '#FFA500',
      'purple': '#800080'
    };
    
    const hexColor = colorMap[color] || color;
    
    if (!editorRef.current) return;
    editorRef.current.focus();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    if (selection.toString().length > 0) {
      document.execCommand('foreColor', false, hexColor);
      const newContent = editorRef.current.innerHTML;
      setTemplateContent(newContent);
      debouncedUpdateContent(newContent);
    } else {
      document.execCommand('foreColor', false, hexColor);
    }
  }, [debouncedUpdateContent]);
  
  // Toggle HTML source view
  const [showHtmlSource, setShowHtmlSource] = useState(false);
  const toggleHtmlSource = useCallback(() => {
    setShowHtmlSource(prev => !prev);
  }, []);
  
  // Fullscreen editor
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);
  
  // Insert placeholder at cursor position
  const insertPlaceholder = (placeholder: string) => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      const newContent = editorRef.current.innerHTML + placeholder;
      editorRef.current.innerHTML = newContent;
      setTemplateContent(newContent);
      toast.success(`Inserted ${placeholder}`);
      return;
    }
    
    const range = selection.getRangeAt(0);
    
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      const newContent = editorRef.current.innerHTML + placeholder;
      editorRef.current.innerHTML = newContent;
      setTemplateContent(newContent);
      toast.success(`Inserted ${placeholder}`);
      return;
    }
    
    range.deleteContents();
    const textNode = document.createTextNode(placeholder);
    range.insertNode(textNode);
    
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
    
    setTemplateContent(editorRef.current.innerHTML);
    toast.success(`Inserted ${placeholder}`);
  };
  
  // Copy placeholder to clipboard
  const copyPlaceholder = (placeholder: string) => {
    navigator.clipboard.writeText(placeholder);
    toast.success(`Copied ${placeholder} to clipboard`);
  };
  
  // Get student display name
  const getStudentName = (student: Student) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile: any = student.profile;
    if (!profile) return student.student_number;
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || student.student_number;
  };
  
  // Get full name for a student
  const getFullName = (student: Student) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile: any = student.profile;
    if (!profile) return '';
    const parts = [
      profile.first_name,
      profile.father_name,
      profile.grandfather_name,
      profile.last_name
    ].filter(Boolean);
    return parts.join(' ');
  };
  
  // Get photo URL for student
  const getPhotoUrl = useCallback((student: Student) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile: any = student.profile;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentAny: any = student;
    
    const photoUrl = profile?.profile_photo_url || 
           profile?.avatar_url || 
           profile?.photo_url ||
           profile?.image_url ||
           studentAny?.profile_photo_url ||
           studentAny?.avatar_url ||
           studentAny?.photo_url ||
           studentAny?.image_url ||
           null;
    
    if (photoUrl && 
        typeof photoUrl === 'string' && 
        photoUrl.trim() !== '' && 
        photoUrl !== 'null' && 
        photoUrl !== 'undefined' &&
        (photoUrl.startsWith('http') || photoUrl.startsWith('/'))) {
      return photoUrl;
    }
    return '/images/default-avatar.svg';
  }, []);
  
  // Replace placeholders with student data
  const replacePlaceholders = (content: string, student: Student): string => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile: any = student.profile || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentWithAcademics = student as any;
    
    const parentInfo = studentWithAcademics.parent_links?.[0]?.parent?.profiles;
    const parentName = parentInfo ? `${parentInfo.first_name || ''} ${parentInfo.last_name || ''}`.trim() : '';
    const parentPhone = parentInfo?.phone || '';
    
    const now = new Date();
    const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const schoolYear = `${year}-${year + 1}`;
    const validUntil = new Date(year + 1, 7, 31).toLocaleDateString();
    
    const dateOfBirth = student.custom_fields?.personal?.date_of_birth || profile.date_of_birth;
    const gender = student.custom_fields?.personal?.gender || profile.gender;
    const address = student.custom_fields?.personal?.address || profile.address;
    const admissionDate = student.custom_fields?.academic?.admission_date;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const campusAny = selectedCampus as any;
    
    const replacedContent = content
      .replace(/__FULL_NAME__/g, getFullName(student) || getStudentName(student))
      .replace(/__FIRST_NAME__/g, profile.first_name || '')
      .replace(/__FATHER_NAME__/g, profile.father_name || '')
      .replace(/__GRANDFATHER_NAME__/g, profile.grandfather_name || '')
      .replace(/__LAST_NAME__/g, profile.last_name || '')
      .replace(/__DATE_OF_BIRTH__/g, dateOfBirth ? new Date(dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' }) : '')
      .replace(/__GENDER__/g, gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : '')
      .replace(/__BLOOD_GROUP__/g, student.medical_info?.blood_group || studentWithAcademics.blood_group || '')
      .replace(/__EMAIL__/g, profile.email || '')
      .replace(/__PHONE__/g, profile.phone || '')
      .replace(/__ADDRESS__/g, address || '')
      .replace(/__STUDENT_ID__/g, student.id || '')
      .replace(/__STUDENT_NUMBER__/g, student.student_number || '')
      .replace(/__ADMISSION_NUMBER__/g, student.student_number || '')
      .replace(/__ROLL_NUMBER__/g, student.student_number || '')
      .replace(/__GRADE_LEVEL__/g, studentWithAcademics.grade_level_name || studentWithAcademics.grade_level || '')
      .replace(/__GRADE_ID__/g, studentWithAcademics.grade_level_id || student.grade_level_id || '')
      .replace(/__SECTION__/g, studentWithAcademics.section_name || '')
      .replace(/__ADMISSION_DATE__/g, admissionDate ? new Date(admissionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' }) : (student.created_at ? new Date(student.created_at).toLocaleDateString() : ''))
      .replace(/__PARENT_NAME__/g, parentName)
      .replace(/__PARENT_PHONE__/g, parentPhone)
      .replace(/__EMERGENCY_CONTACT__/g, parentPhone)
      .replace(/__SCHOOL_TITLE__/g, campusAny?.school_name || selectedCampus?.name || '')
      .replace(/__SCHOOL_PRINCIPAL__/g, campusAny?.principal_name || campusAny?.principal || '')
      .replace(/__CAMPUS__/g, selectedCampus?.name || '')
      .replace(/__CAMPUS_ADDRESS__/g, selectedCampus?.address || '')
      .replace(/__CAMPUS_PHONE__/g, selectedCampus?.phone || '')
      .replace(/__SCHOOL_YEAR__/g, schoolYear)
      .replace(/__DATE__/g, new Date().toLocaleDateString())
      .replace(/__VALID_UNTIL__/g, validUntil)
      .replace(/__PHOTO__/g, `<img src="${getPhotoUrl(student)}" alt="${getFullName(student) || getStudentName(student)}" style="max-width:100%;height:auto;"/>`)
      .replace(/__SCHOOL_LOGO__/g, campusAny?.logo_url ? `<img src="${campusAny.logo_url}" alt="${selectedCampus?.name}" style="max-width:100%;height:auto;"/>` : '');
    
    return replacedContent;
  };
  
  // Handle student toggle selection
  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };
  
  // Generate certificates
  const handleGenerate = () => {
    if (selectedStudentIds.length === 0) {
      toast.error('Please select at least one student');
      return;
    }
    
    setIsGenerating(true);
    setShowGeneratedCerts(true);
    
    setTimeout(() => {
      setIsGenerating(false);
      toast.success(`Generated certificates for ${selectedStudentIds.length} students`);
    }, 500);
  };
  
  // Get selected students
  const selectedStudents = useMemo(() => {
    return students.filter(s => selectedStudentIds.includes(s.id));
  }, [students, selectedStudentIds]);
  
  // Print certificates
  const handlePrint = () => {
    if (isGenerating || selectedStudents.length === 0) {
      toast.error('Please wait for certificates to generate before printing');
      return;
    }

    setTimeout(() => {
      window.print();
    }, 100);
  };
  
  return (
    <>
      {/* Print Area - Only visible when printing */}
      {showGeneratedCerts && selectedStudents.length > 0 && (
        <div 
          className="certificate-print-area"
          style={{ display: 'none' }}
        >
          <div className="space-y-8">
            {selectedStudents.map((student) => {
              const processedContent = replacePlaceholders(templateContent, student);
              
              return (
                <div 
                  key={student.id} 
                  className="certificate-item"
                  style={{
                    padding: `${designSettings.certificatePaddingTop}px ${designSettings.certificatePaddingLeft}px`,
                    backgroundImage: designSettings.backgroundImage ? `url(${designSettings.backgroundImage})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: '#ffffff',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                    minHeight: '700px',
                    width: '100%',
                    boxSizing: 'border-box',
                    overflow: 'visible',
                    fontSize: `${designSettings.fontSize}px`,
                    color: designSettings.textColor,
                    lineHeight: designSettings.lineHeight,
                  }}
                >
                  <div 
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                    dangerouslySetInnerHTML={{ __html: processedContent }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Main UI - Hidden when printing */}
      <div className="container mx-auto py-6 space-y-6 print:hidden">
        {/* Header */}
        {!hideHeaders && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Certificate of Enrollment</h1>
              </div>
            </div>
            <Button 
              onClick={handleGenerate}
              disabled={selectedStudentIds.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Certificate for Selected Students
            </Button>
          </div>
        )}
        
        {!showGeneratedCerts ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Panel - Template Editor & Settings */}
            <div className="xl:col-span-2 space-y-6">
              {/* Template Editor Card */}
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {/* Toolbar */}
                  <div className="flex items-center gap-1 p-2 bg-muted/50 rounded-lg border flex-wrap">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('bold')} title="Bold">
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('italic')} title="Italic">
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('underline')} title="Underline">
                      <Underline className="h-4 w-4" />
                    </Button>
                    
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('insertUnorderedList')} title="Bullet List">
                      <List className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('insertOrderedList')} title="Numbered List">
                      <ListOrdered className="h-4 w-4" />
                    </Button>
                    
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('justifyLeft')} title="Align Left">
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('justifyCenter')} title="Align Center">
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('justifyRight')} title="Align Right">
                      <AlignRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand('justifyFull')} title="Justify">
                      <AlignJustify className="h-4 w-4" />
                    </Button>
                    
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openLinkDialog} title="Insert Link">
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openImageDialog} title="Insert Image">
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                    
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    
                    <Select onValueChange={changeTextColor}>
                      <SelectTrigger className="w-[60px] h-8 text-xs">
                        <div className="flex items-center gap-1">
                          <Type className="h-3 w-3" />
                          <div className="w-3 h-3 bg-black rounded-sm" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="black">Black</SelectItem>
                        <SelectItem value="red">Red</SelectItem>
                        <SelectItem value="blue">Blue</SelectItem>
                        <SelectItem value="green">Green</SelectItem>
                        <SelectItem value="orange">Orange</SelectItem>
                        <SelectItem value="purple">Purple</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={toggleHtmlSource}
                      title="View HTML Source"
                    >
                      <Code className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={toggleFullscreen}
                      title="Fullscreen"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Rich Text Editor */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Certificate Template Content
                      <span className="text-xs text-muted-foreground ml-2">(Edit text, insert links & images here)</span>
                    </Label>
                    {showHtmlSource ? (
                      <textarea
                        className="min-h-[400px] p-4 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm w-full"
                        value={templateContent}
                        onChange={(e) => {
                          const content = e.target.value;
                          setTemplateContent(content);
                          debouncedUpdateContent(content);
                          if (editorRef.current) {
                            editorRef.current.innerHTML = content;
                          }
                        }}
                        placeholder="Enter your certificate template HTML..."
                      />
                    ) : (
                      <div
                        ref={(el) => {
                          if (el && el !== editorRef.current) {
                            editorRef.current = el;
                            if (!el.innerHTML || el.innerHTML === '') {
                              el.innerHTML = templateContent || DEFAULT_TEMPLATE;
                            }
                          }
                        }}
                        contentEditable
                        suppressContentEditableWarning
                        className="min-h-[400px] p-4 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        onInput={(e) => {
                          const content = (e.target as HTMLDivElement).innerHTML;
                          setTemplateContent(content);
                        }}
                        onBlur={(e) => {
                          const content = (e.target as HTMLDivElement).innerHTML;
                          setTemplateContent(content);
                        }}
                        data-placeholder="Click here to start editing your certificate template..."
                      />
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold">ℹ</span>
                      Type or paste content, use toolbar for formatting, click Link/Image icons to insert media
                    </p>
                  </div>
                  
                  <Separator />
                  
                  {/* Substitutions Field Selector */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Substitutions
                      <span className="text-xs text-muted-foreground ml-2">(Select a field to insert placeholder)</span>
                    </Label>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Select 
                        value={selectedField} 
                        onValueChange={setSelectedField}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select Field..." />
                        </SelectTrigger>
                        <SelectContent side="bottom" align="start" sideOffset={5} className="max-h-[300px]">
                          {Object.entries(GROUPED_FIELDS).map(([category, fields]) => (
                            <div key={category}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                                {category}
                              </div>
                              {fields.map((field) => (
                                <SelectItem key={field.id} value={field.id}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {selectedField && (
                        <code className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-mono">
                          {selectedField}
                        </code>
                      )}
                      
                      <Button
                        onClick={() => selectedField && insertPlaceholder(selectedField)}
                        disabled={!selectedField}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <ClipboardPaste className="h-4 w-4 mr-2" />
                        Insert
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => selectedField && copyPlaceholder(selectedField)}
                        disabled={!selectedField}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <Info className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>How it works:</strong> Placeholders like <code className="px-1 py-0.5 bg-blue-100 rounded text-xs">__FULL_NAME__</code> will be automatically replaced with actual student data when you print certificates.
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              {/* Design Settings Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings className="h-5 w-5" />
                    Design Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Background Image */}
                  <div>
                    <Label className="text-sm font-medium">Background Image (.jpg, .png)</Label>
                    <Input 
                      type="file" 
                      accept=".jpg,.jpeg,.png"
                      className="mt-1"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setDesignSettings(prev => ({
                              ...prev,
                              backgroundImage: event.target?.result as string
                            }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {designSettings.backgroundImage && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary">Background set</Badge>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setDesignSettings(prev => ({ ...prev, backgroundImage: "" }))}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  {/* Hide Headers Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Hide Headers</Label>
                      <p className="text-xs text-muted-foreground">Hide the page header when editing</p>
                    </div>
                    <Switch
                      checked={hideHeaders}
                      onCheckedChange={setHideHeaders}
                    />
                  </div>
                  
                  <Separator />
                  
                  {/* Mailing Labels Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Mailing Labels</Label>
                      <p className="text-xs text-muted-foreground">Format output as mailing labels</p>
                    </div>
                    <Switch
                      checked={mailingLabels}
                      onCheckedChange={setMailingLabels}
                    />
                  </div>
                  
                  <Separator />
                  
                  {/* Certificate Padding */}
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">CERTIFICATE PADDING</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <Input 
                          type="number"
                          value={designSettings.certificatePaddingTop}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, certificatePaddingTop: parseInt(e.target.value) || 0 }))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground">Top and bottom (pixels)</span>
                      </div>
                      <div>
                        <Input 
                          type="number"
                          value={designSettings.certificatePaddingLeft}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, certificatePaddingLeft: parseInt(e.target.value) || 0 }))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground">Left and right (pixels)</span>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Typography */}
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">TYPOGRAPHY</Label>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div>
                        <Input 
                          type="number"
                          value={designSettings.fontSize}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) || 14 }))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground">Font size (px)</span>
                      </div>
                      <div>
                        <Input 
                          type="color"
                          value={designSettings.textColor}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, textColor: e.target.value }))}
                          className="w-full h-10"
                        />
                        <span className="text-xs text-muted-foreground">Text color</span>
                      </div>
                      <div>
                        <Input 
                          type="number"
                          step="0.1"
                          value={designSettings.lineHeight}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, lineHeight: parseFloat(e.target.value) || 1.6 }))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground">Line height</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Right Panel - Student Selection */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5" />
                    Select Students
                  </CardTitle>
                  <CardDescription>
                    {selectedStudentIds.length} of {filteredStudents.length} selected
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search students..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    
                    <Select value={selectedGradeLevel} onValueChange={setSelectedGradeLevel}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Grade Levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Grade Levels</SelectItem>
                        {gradeLevels.map(grade => (
                          <SelectItem key={grade.id} value={grade.id}>
                            {grade.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={selectedSection} onValueChange={setSelectedSection}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Sections" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        {filteredSections.map(section => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Info message when showing limited results */}
                  {selectedGradeLevel === 'all' && selectedSection === 'all' && !searchQuery && (
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                      <Info className="h-4 w-4 inline mr-2" />
                      Showing first 10 students as reference. Select a grade level or section to view all students.
                    </div>
                  )}
                  
                  {/* Student List with Switch toggles */}
                  <ScrollArea className="h-[400px]">
                    {loadingStudents ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No students found
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {filteredStudents.map(student => {
                          const studentWithAcademics = student as Student & { 
                            grade_level_name?: string; 
                            section_name?: string;
                          };
                          return (
                            <div
                              key={student.id}
                              className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/50"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {getStudentName(student)}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {student.student_number}
                                  {studentWithAcademics.grade_level_name && ` • ${studentWithAcademics.grade_level_name}`}
                                  {studentWithAcademics.section_name && ` - ${studentWithAcademics.section_name}`}
                                </p>
                              </div>
                              <Switch
                                checked={selectedStudentIds.includes(student.id)}
                                onCheckedChange={() => toggleStudent(student.id)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                  
                  {/* Pagination Controls */}
                  {!loadingStudents && filteredStudents.length > 0 && (
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-muted-foreground">
                          {selectedGradeLevel === 'all' && selectedSection === 'all' && !searchQuery ? (
                            <span>Showing first 10 students</span>
                          ) : (
                            <span>
                              {((currentPage - 1) * studentsPerPage) + 1}–{Math.min(currentPage * studentsPerPage, totalStudents)} of {totalStudents}
                            </span>
                          )}
                        </div>
                        
                        {(selectedGradeLevel !== 'all' || selectedSection !== 'all' || searchQuery) && totalStudents > studentsPerPage && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            
                            <span className="text-xs">
                              Page {currentPage} of {Math.ceil(totalStudents / studentsPerPage)}
                            </span>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalStudents / studentsPerPage), p + 1))}
                              disabled={currentPage >= Math.ceil(totalStudents / studentsPerPage)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            
                            <Select 
                              value={studentsPerPage.toString()} 
                              onValueChange={(value) => {
                                setStudentsPerPage(Number(value));
                                setCurrentPage(1);
                              }}
                            >
                              <SelectTrigger className="w-[100px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="10">10 / page</SelectItem>
                                <SelectItem value="25">25 / page</SelectItem>
                                <SelectItem value="50">50 / page</SelectItem>
                                <SelectItem value="100">100 / page</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Generated Certificates View */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Preview generated certificates. Use Print to create a hard copy.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowGeneratedCerts(false)}
                >
                  Back to Editor
                </Button>
                <Button
                  onClick={handlePrint}
                  disabled={isGenerating}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Certificates
                </Button>
              </div>
            </div>
            
            <Separator />
            
            {/* Generated Certificates */}
            <div className="space-y-8">
              {isGenerating ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                selectedStudents.map((student) => {
                  const processedContent = replacePlaceholders(templateContent, student);
                  
                  return (
                    <Card key={student.id} className="overflow-hidden">
                      <div 
                        className="certificate-item"
                        style={{
                          padding: `${designSettings.certificatePaddingTop}px ${designSettings.certificatePaddingLeft}px`,
                          backgroundImage: designSettings.backgroundImage ? `url(${designSettings.backgroundImage})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          minHeight: '500px',
                          fontSize: `${designSettings.fontSize}px`,
                          color: designSettings.textColor,
                          lineHeight: designSettings.lineHeight,
                        }}
                      >
                        <div dangerouslySetInnerHTML={{ __html: processedContent }} />
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Editor and Print Styles */}
      <style jsx global>{`
        /* Editor link styles */
        [contenteditable] a {
          color: #2563eb;
          text-decoration: underline;
          cursor: pointer;
        }
        
        [contenteditable] a:hover {
          color: #1d4ed8;
        }
        
        /* Empty editor placeholder */
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          font-style: italic;
          pointer-events: none;
        }
        
        [contenteditable]:focus:empty:before {
          content: "";
        }
        
        /* Editor image styles */
        [contenteditable] img {
          max-width: 100%;
          height: auto;
          display: inline-block;
          vertical-align: middle;
          cursor: move;
          border: 2px dashed transparent;
          transition: border-color 0.2s;
        }
        
        [contenteditable] img:hover {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        [contenteditable] img.editable-image {
          resize: both;
          overflow: hidden;
        }
        
        [contenteditable] img:active {
          opacity: 0.7;
          cursor: grabbing;
        }
        
        @media print {
          header, nav, aside, .sidebar, .topbar, .navbar, .navigation {
            display: none !important;
          }
          
          .toast, .notification, .alert, [role="alert"], [role="status"],
          .sonner-toast, .sonner-toaster, .toaster, [data-sonner-toaster],
          [data-radix-toast], [data-radix-portal] {
            display: none !important;
          }
          
          button, .button, input, select, textarea, .modal, .dialog,
          .overlay, .dropdown, .menu, .tooltip, .popover, .card,
          .badge, .avatar, .icon, .spinner, .loader, .checkbox,
          .radio, .switch, .tabs, .accordion, .select {
            display: none !important;
          }
          
          .container, .print\\:hidden {
            display: none !important;
          }
          
          .certificate-print-area {
            display: block !important;
            position: static !important;
            visibility: visible !important;
            width: 100% !important;
            height: auto !important;
          }
          
          .certificate-print-area *,
          .certificate-print-area *::before,
          .certificate-print-area *::after {
            display: block !important;
            visibility: visible !important;
            position: static !important;
          }
          
          .certificate-item {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: block !important;
            visibility: visible !important;
            min-height: 100vh !important;
          }
          
          .certificate-item:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          
          @page {
            margin: 0.5in;
            size: auto;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }
      `}</style>
      
      {/* Link Insert Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>
              Add a hyperlink to your certificate template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="link-url">URL *</Label>
              <Input
                id="link-url"
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="link-text">Text to Display</Label>
              <Input
                id="link-text"
                type="text"
                placeholder="Click here (optional)"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to use selected text
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsertLink}>Insert Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Image Insert Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert/Edit Image</DialogTitle>
            <DialogDescription>
              Add an image to your certificate template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cert-image-url">Image URL</Label>
              <Input
                id="cert-image-url"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={!!imageFile}
                className="mt-1"
              />
            </div>
            <div className="text-center text-sm text-muted-foreground">OR</div>
            <div>
              <Label htmlFor="cert-image-file">Upload Image</Label>
              <Input
                id="cert-image-file"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageFile(file);
                    setImageUrl("");
                  }
                }}
                className="mt-1"
              />
              {imageFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {imageFile.name}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="cert-image-alt">Image Description (Alt Text)</Label>
              <Input
                id="cert-image-alt"
                type="text"
                placeholder="Description of the image"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cert-image-width">Width (px)</Label>
                <Input
                  id="cert-image-width"
                  type="number"
                  placeholder="Auto"
                  value={imageWidth}
                  onChange={(e) => setImageWidth(e.target.value)}
                  className="mt-1"
                  min="10"
                />
              </div>
              <div>
                <Label htmlFor="cert-image-height">Height (px)</Label>
                <Input
                  id="cert-image-height"
                  type="number"
                  placeholder="Auto"
                  value={imageHeight}
                  onChange={(e) => setImageHeight(e.target.value)}
                  className="mt-1"
                  min="10"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave dimensions empty for auto-sizing. Images are draggable after insertion.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsertImage}>Insert Image</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Fullscreen Editor Dialog */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] h-[95vh]">
          <DialogHeader>
            <DialogTitle>Certificate Editor - Fullscreen Mode</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {showHtmlSource ? (
              <textarea
                className="w-full h-[calc(95vh-120px)] p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-none"
                value={templateContent}
                onChange={(e) => {
                  const content = e.target.value;
                  setTemplateContent(content);
                  debouncedUpdateContent(content);
                  if (editorRef.current) {
                    editorRef.current.innerHTML = content;
                  }
                }}
              />
            ) : (
              <div
                contentEditable
                suppressContentEditableWarning
                className="w-full h-[calc(95vh-120px)] p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: templateContent }}
                onInput={(e) => {
                  const content = (e.target as HTMLDivElement).innerHTML;
                  setTemplateContent(content);
                  if (editorRef.current) {
                    editorRef.current.innerHTML = content;
                  }
                }}
                onBlur={(e) => {
                  const content = (e.target as HTMLDivElement).innerHTML;
                  setTemplateContent(content);
                  if (editorRef.current) {
                    editorRef.current.innerHTML = content;
                  }
                }}
              />
            )}
          </div>
          <DialogFooter>
            <Button onClick={toggleFullscreen}>Close Fullscreen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}