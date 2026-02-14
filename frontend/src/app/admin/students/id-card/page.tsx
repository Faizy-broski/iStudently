"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  IdCard, 
  Users, 
  Search, 
  CheckSquare, 
  Square, 
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
  Download,
  Settings,
  Type,
  Info,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { useCampus } from "@/context/CampusContext";
import { useGradeLevels, useSections } from "@/hooks/useAcademics";
import { getStudents, Student } from "@/lib/api/students";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import html2canvas from 'html2canvas';
import JSZip from 'jszip';

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

// Available placeholder fields for ID cards
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
  { id: '__SECTION__', label: 'Section', category: 'Academic' },
  { id: '__ADMISSION_DATE__', label: 'Admission Date', category: 'Academic' },
  
  // Parent/Guardian
  { id: '__PARENT_NAME__', label: 'Parent Name', category: 'Family' },
  { id: '__PARENT_PHONE__', label: 'Parent Phone', category: 'Family' },
  { id: '__EMERGENCY_CONTACT__', label: 'Emergency Contact', category: 'Family' },
  
  // School Information
  { id: '__CAMPUS__', label: 'Campus Name', category: 'School' },
  { id: '__CAMPUS_ADDRESS__', label: 'Campus Address', category: 'School' },
  { id: '__CAMPUS_PHONE__', label: 'Campus Phone', category: 'School' },
  { id: '__SCHOOL_YEAR__', label: 'Academic Year', category: 'School' },
  
  // System
  { id: '__PHOTO__', label: 'Student Photo', category: 'Media' },
  { id: '__SCHOOL_LOGO__', label: 'School Logo', category: 'Media' },
  { id: '__DATE__', label: 'Current Date', category: 'System' },
  { id: '__VALID_UNTIL__', label: 'Valid Until Date', category: 'System' },
];

// Group fields by category
const GROUPED_FIELDS = PLACEHOLDER_FIELDS.reduce((acc, field) => {
  if (!acc[field.category]) acc[field.category] = [];
  acc[field.category].push(field);
  return acc;
}, {} as Record<string, typeof PLACEHOLDER_FIELDS>);

// Default template
const DEFAULT_TEMPLATE = `<p style="font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 8px;">__FULL_NAME__</p>
<p style="color: #666; margin: 4px 0;"><span style="color: #333;">Born:</span> __DATE_OF_BIRTH__</p>
<p style="color: #666; margin: 4px 0;"><span style="color: #333;">Grade Level:</span> __GRADE_LEVEL__</p>
<p style="color: #666; margin: 4px 0;"><span style="color: #333;">School Year:</span> __SCHOOL_YEAR__</p>`;

export default function StudentIdCardPage() {
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
  
  // State for template content - important to track editor content in state
  const [templateContent, setTemplateContent] = useState<string>(DEFAULT_TEMPLATE);
  
  // State for data
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [studentsPerPage, setStudentsPerPage] = useState(10);
  
  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGeneratedCards, setShowGeneratedCards] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Design settings
  const [designSettings, setDesignSettings] = useState({
    backgroundImage: "",
    cardPaddingTop: 46,
    cardPaddingLeft: 13,
    textPaddingTop: 18,
    textPaddingLeft: 13,
    photoPaddingTop: 32,
    photoPaddingLeft: 13,
    photoWidth: 132,
    photoPosition: "left" as "left" | "right" | "center",
    fontSize: 14,
    textColor: "#000000",
    lineHeight: 1.5,
  });
  
  // Hooks for academics data
  const { gradeLevels } = useGradeLevels();
  const { sections } = useSections();
  
  // Editor ref
  const editorRef = useRef<HTMLDivElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  
  // Debounced content update for better performance
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
      // Clear any pending debounced updates
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
    // If specific grade or section selected, show all with pagination
    if (selectedGradeLevel !== 'all' || selectedSection !== 'all' || searchQuery) {
      return studentsPerPage;
    }
    // Otherwise show only 10 for reference
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
      } catch (error) {
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
        // Remove the original image
        draggedImage.remove();
        
        // Insert at new position
        selection.removeAllRanges();
        selection.addRange(range);
        range.insertNode(draggedImage);
        
        // Update content
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
      // Focus editor first to ensure command works
      if (editorRef.current) {
        editorRef.current.focus();
      }
      
      // Execute the command
      document.execCommand(command, false, value);
      
      // Update state after formatting
      if (editorRef.current) {
        const newContent = editorRef.current.innerHTML;
        setTemplateContent(newContent);
        debouncedUpdateContent(newContent);
      }
    } catch (error) {
      toast.error('Text formatting failed');
    }
  }, [debouncedUpdateContent]);
  
  // Open link dialog
  const openLinkDialog = useCallback(() => {
    // Save current selection
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
      
      // Restore saved selection if exists
      if (savedSelection) {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(savedSelection);
        }
      }
      
      // Determine the text to display
      const selection = window.getSelection();
      const selectedText = selection?.toString() || '';
      const displayText = linkText || selectedText || linkUrl;
      
      // Create and insert the link HTML
      const linkHtml = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" style="color: blue; text-decoration: underline;">${displayText}</a>&nbsp;`;
      
      // Delete selected content if any, then insert link
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
      
      // Update content immediately
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
    // Save current selection
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
        
        // Restore saved selection if exists
        if (savedSelection) {
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(savedSelection);
          }
        }
        
        // Build style with custom dimensions or defaults
        let styleStr = 'max-width: 100%; cursor: move; display: inline-block;';
        if (imageWidth && imageHeight) {
          styleStr = `width: ${imageWidth}px; height: ${imageHeight}px; cursor: move; display: inline-block;`;
        } else if (imageWidth) {
          styleStr = `width: ${imageWidth}px; height: auto; cursor: move; display: inline-block;`;
        } else if (imageHeight) {
          styleStr = `width: auto; height: ${imageHeight}px; cursor: move; display: inline-block;`;
        }
        
        // Create draggable, resizable image
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
        
        toast.success('Image inserted successfully (drag to reposition)');
      }
    };
    
    if (imageFile) {
      // Convert file to base64 and insert
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
    // Convert color names to hex values
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
    
    // Ensure the editor has focus
    editorRef.current.focus();
    
    // Get the current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    // If there's selected text, apply color
    if (selection.toString().length > 0) {
      document.execCommand('foreColor', false, hexColor);
      const newContent = editorRef.current.innerHTML;
      setTemplateContent(newContent);
      debouncedUpdateContent(newContent);
    } else {
      // If no text is selected, just set the color for future typing
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
  
  // Insert placeholder at cursor position in editor
  const insertPlaceholder = (placeholder: string) => {
    if (!editorRef.current) return;
    
    editorRef.current.focus();
    
    // Get current selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // If no selection, append to end
      const newContent = editorRef.current.innerHTML + placeholder;
      editorRef.current.innerHTML = newContent;
      setTemplateContent(newContent);
      toast.success(`Inserted ${placeholder}`);
      return;
    }
    
    const range = selection.getRangeAt(0);
    
    // Check if cursor is inside the editor
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      // If not inside editor, append to end
      const newContent = editorRef.current.innerHTML + placeholder;
      editorRef.current.innerHTML = newContent;
      setTemplateContent(newContent);
      toast.success(`Inserted ${placeholder}`);
      return;
    }
    
    // Insert at cursor position
    range.deleteContents();
    const textNode = document.createTextNode(placeholder);
    range.insertNode(textNode);
    
    // Move cursor after inserted text
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Update state with new content
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
  
  // Replace placeholders with student data
  const replacePlaceholders = (content: string, student: Student): string => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile: any = student.profile || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentWithAcademics = student as any;
    
    // Get parent info
    const parentInfo = studentWithAcademics.parent_links?.[0]?.parent?.profiles;
    const parentName = parentInfo ? `${parentInfo.first_name || ''} ${parentInfo.last_name || ''}`.trim() : '';
    const parentPhone = parentInfo?.phone || '';
    
    // Get current academic year (e.g., "2025-2026")
    const now = new Date();
    const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const schoolYear = `${year}-${year + 1}`;
    
    // Valid until - typically end of academic year
    const validUntil = new Date(year + 1, 7, 31).toLocaleDateString();
    
    // Extract values from custom_fields (where form actually stores them)
    const dateOfBirth = student.custom_fields?.personal?.date_of_birth || profile.date_of_birth;
    const gender = student.custom_fields?.personal?.gender || profile.gender;
    const address = student.custom_fields?.personal?.address || profile.address;
    const admissionDate = student.custom_fields?.academic?.admission_date;
    
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
      .replace(/__SECTION__/g, studentWithAcademics.section_name || '')
      .replace(/__ADMISSION_DATE__/g, admissionDate ? new Date(admissionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' }) : (student.created_at ? new Date(student.created_at).toLocaleDateString() : ''))
      .replace(/__PARENT_NAME__/g, parentName)
      .replace(/__PARENT_PHONE__/g, parentPhone)
      .replace(/__EMERGENCY_CONTACT__/g, parentPhone)
      .replace(/__CAMPUS__/g, selectedCampus?.name || '')
      .replace(/__CAMPUS_ADDRESS__/g, selectedCampus?.address || '')
      .replace(/__CAMPUS_PHONE__/g, selectedCampus?.phone || '')
      .replace(/__SCHOOL_YEAR__/g, schoolYear)
      .replace(/__DATE__/g, new Date().toLocaleDateString())
      .replace(/__VALID_UNTIL__/g, validUntil)
      .replace(/__PHOTO__/g, `<img src="${getPhotoUrl(student)}" alt="${getFullName(student) || getStudentName(student)}" style="max-width:100%;height:auto;"/>`)
      .replace(/__SCHOOL_LOGO__/g, (() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const campusAny = selectedCampus as any;
        return campusAny?.logo_url ? `<img src="${campusAny.logo_url}" alt="${selectedCampus?.name}" style="max-width:100%;height:auto;"/>` : '';
      })());
    
    return replacedContent;
  };
  
  // Handle student selection
  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };
  
  // Select all/none students
  const toggleAllStudents = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    }
  };
  
  // Generate ID cards
  const handleGenerate = () => {
    if (selectedStudentIds.length === 0) {
      toast.error('Please select at least one student');
      return;
    }
    
    setIsGenerating(true);
    setShowGeneratedCards(true);
    
    setTimeout(() => {
      setIsGenerating(false);
      toast.success(`Generated ID cards for ${selectedStudentIds.length} students`);
    }, 500);
  };
  
  // Get selected students
  const selectedStudents = useMemo(() => {
    return students.filter(s => selectedStudentIds.includes(s.id));
  }, [students, selectedStudentIds]);
  
  // Helper to inline all styles to avoid CSS custom property issues with html2canvas
  const inlineAllStyles = (element: HTMLElement) => {
    const allElements = element.querySelectorAll('*');
    
    const processElement = (el: Element) => {
      const htmlEl = el as HTMLElement;
      if (!htmlEl.style) return;
      
      const computed = window.getComputedStyle(htmlEl);
      
      // Inline all color-related properties
      const colorProps = [
        'color', 'background-color', 'border-color', 'border-top-color', 
        'border-right-color', 'border-bottom-color', 'border-left-color', 
        'outline-color', 'fill', 'stroke'
      ];
      
      colorProps.forEach(prop => {
        const value = computed.getPropertyValue(prop);
        if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent' && value !== 'none') {
          htmlEl.style.setProperty(prop, value, 'important');
        }
      });
      
      // Inline other important properties that might affect rendering
      const otherProps = [
        'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 
        'text-align', 'text-decoration', 'letter-spacing', 'word-spacing',
        'display', 'visibility', 'opacity', 'width', 'height',
        'background-color', 'background-image', 'background-size', 'background-position'
      ];
      otherProps.forEach(prop => {
        const value = computed.getPropertyValue(prop);
        if (value && value !== 'none' && value !== 'auto') {
          htmlEl.style.setProperty(prop, value, 'important');
        }
      });
    };
    
    // Process all elements including the root
    [element, ...Array.from(allElements)].forEach(processElement);
    
    // Force a reflow to ensure styles are applied
    element.offsetHeight;
  };

  const handleExportImages = async () => {
    if (selectedStudents.length === 0) {
      toast.error('No students selected to export');
      return;
    }
    
    // Ensure cards are generated first
    if (!showGeneratedCards) {
      toast.error('Please generate ID cards first before exporting');
      return;
    }
    
    setIsExporting(true);
    toast.info('Converting ID cards to images...');
    
    try {
      const zip = new JSZip();
      let successCount = 0;
      let failedCards: string[] = [];
      
      for (let i = 0; i < selectedStudents.length; i++) {
        const student = selectedStudents[i];
        const processedContent = replacePlaceholders(templateContent, student);
        
        try {
          // Get dimensions for the card
          const actualWidth = 600; // Fixed width for consistency
          const actualHeight = Math.max(200, 300); // Fixed height for consistency
          
          // Create an iframe to completely isolate the card from global CSS
          const iframe = document.createElement('iframe');
          iframe.style.position = 'absolute';
          iframe.style.left = '-9999px';
          iframe.style.top = '-9999px';
          iframe.style.width = `${actualWidth}px`;
          iframe.style.height = `${actualHeight}px`;
          iframe.style.border = 'none';
          document.body.appendChild(iframe);
          
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) {
            continue;
          }
          
          // Create the card in the iframe
          const simpleCard = iframeDoc.createElement('div');
          
          // Build the CSS text with optional background image
          let cardStyles = `
            width: ${actualWidth}px;
            height: ${actualHeight}px;
            background-color: #ffffff;
            padding-top: ${designSettings.cardPaddingTop}px;
            padding-bottom: ${designSettings.cardPaddingTop}px;
            padding-left: ${designSettings.cardPaddingLeft}px;
            padding-right: ${designSettings.cardPaddingLeft}px;
            box-sizing: border-box;
            font-family: Arial, sans-serif;
            color: ${designSettings.textColor};
            display: flex;
            flex-direction: ${designSettings.photoPosition === 'center' ? 'column' : 'row'};
            align-items: ${designSettings.photoPosition === 'center' ? 'center' : 'flex-start'};
            position: relative;
            margin: 0;
            overflow: visible;
          `;
          
          // Add background image if present
          if (designSettings.backgroundImage) {
            cardStyles += `
              background-image: url(${designSettings.backgroundImage});
              background-size: cover;
              background-position: center;
              background-repeat: no-repeat;
            `;
          }
          
          simpleCard.style.cssText = cardStyles;
          
          // Add content based on photo position
          const photoUrl = getPhotoUrl(student);
          
          // Helper function to create photo element
          const createPhotoElement = () => {
            if (!photoUrl) return null;
            const photoImg = iframeDoc.createElement('img');
            photoImg.src = photoUrl;
            
            let photoStyles = `
              width: ${designSettings.photoWidth}px;
              height: ${designSettings.photoWidth}px;
              object-fit: cover;
              flex-shrink: 0;
              padding-top: ${designSettings.photoPaddingTop}px;
            `;
            
            // Add margin based on position
            if (designSettings.photoPosition === 'left') {
              photoStyles += `margin-right: 20px;`;
            } else if (designSettings.photoPosition === 'right') {
              photoStyles += `margin-left: 20px;`;
            } else {
              photoStyles += `margin-bottom: 10px;`;
            }
            
            photoImg.style.cssText = photoStyles;
            return photoImg;
          };
          
          // Helper function to create text element
          const createTextElement = () => {
            const textDiv = iframeDoc.createElement('div');
            textDiv.style.cssText = `
              flex: 1;
              font-size: ${designSettings.fontSize}px;
              line-height: ${designSettings.lineHeight};
              color: ${designSettings.textColor};
              font-family: Arial, sans-serif;
              margin: 0;
              padding-top: ${designSettings.textPaddingTop}px;
              padding-left: ${designSettings.textPaddingLeft}px;
              background: transparent;
              text-align: ${designSettings.photoPosition === 'center' ? 'center' : 'left'};
              word-wrap: break-word;
              overflow-wrap: break-word;
            `;
            textDiv.innerHTML = processedContent;
            return textDiv;
          };
          
          // Add elements in correct order based on photo position
          if (designSettings.photoPosition === 'right') {
            // Text first, then photo
            simpleCard.appendChild(createTextElement());
            const photo = createPhotoElement();
            if (photo) simpleCard.appendChild(photo);
          } else {
            // Photo first (for left and center positions), then text
            const photo = createPhotoElement();
            if (photo) simpleCard.appendChild(photo);
            simpleCard.appendChild(createTextElement());
          }
          
          iframeDoc.body.appendChild(simpleCard);
          iframeDoc.body.style.margin = '0';
          iframeDoc.body.style.padding = '0';
          iframeDoc.body.style.backgroundColor = '#ffffff';
          
          // Preload background image if present to ensure it's ready for html2canvas
          if (designSettings.backgroundImage) {
            await new Promise<void>((resolve, reject) => {
              const img = new Image();
              img.crossOrigin = 'anonymous'; // Enable CORS
              img.onload = () => resolve();
              img.onerror = () => resolve(); // Continue even if image fails to load
              img.src = designSettings.backgroundImage;
              // Timeout after 3 seconds
              setTimeout(() => resolve(), 3000);
            });
          }
          
          // Wait a moment for the iframe to fully render
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Use html2canvas on the card element inside the iframe, not the iframe itself
          const canvas = await html2canvas(simpleCard, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: actualWidth,
            height: actualHeight,
          });
          
          // Clean up iframe
          document.body.removeChild(iframe);
          
          // Convert canvas to blob
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => {
              resolve(blob!);
            }, 'image/png');
          });
          
          // Add to ZIP file
          const fileName = `id-card-${student.student_number || `student-${i + 1}`}.png`;
          zip.file(fileName, blob);
          
          successCount++;
        } catch (cardError) {
          failedCards.push(student.student_number || `student-${i + 1}`);
        }
      }
      
      if (successCount === 0) {
        toast.error('Failed to export any cards. Please try again.');
        return;
      }
      
      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Create download link for ZIP
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `id-cards-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up object URL
      URL.revokeObjectURL(link.href);
      
      if (failedCards.length > 0) {
        toast.warning(`Exported ${successCount} cards successfully. Failed: ${failedCards.join(', ')}`);
      } else {
        toast.success(`Successfully exported ${successCount} ID cards as ZIP file`);
      }
    } catch (error) {
      toast.error('Failed to export images. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  // Print ID cards
  const handlePrint = () => {
    // Ensure cards are generated before printing
    if (isGenerating || selectedStudents.length === 0) {
      toast.error('Please wait for cards to generate before printing');
      return;
    }

    // Small delay to ensure any pending UI updates complete
    setTimeout(() => {
      window.print();
    }, 100);
  };
  
  // Get photo URL for student (memoized for performance)
  const getPhotoUrl = useCallback((student: Student) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile: any = student.profile;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentAny: any = student;
    
    // Check multiple possible photo fields from various sources
    const photoUrl = profile?.profile_photo_url || 
           profile?.avatar_url || 
           profile?.photo_url ||
           profile?.image_url ||
           studentAny?.profile_photo_url ||
           studentAny?.avatar_url ||
           studentAny?.photo_url ||
           studentAny?.image_url ||
           null;
    
    // Validate URL format and return photo URL or default
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
  
  return (
    <>
      {/* Print Area - Only visible when printing */}
      {showGeneratedCards && selectedStudents.length > 0 && (
        <div 
          className="id-card-print-area"
          style={{ display: 'none' }}
        >
          <div className="space-y-8">
            {selectedStudents.map((student) => {
              const processedContent = replacePlaceholders(templateContent, student);
              
              return (
                <div 
                  key={student.id} 
                  className="id-card-item"
                  style={{
                    paddingTop: `${designSettings.cardPaddingTop}px`,
                    paddingBottom: `${designSettings.cardPaddingTop}px`,
                    paddingLeft: `${designSettings.cardPaddingLeft}px`,
                    paddingRight: `${designSettings.cardPaddingLeft}px`,
                    backgroundImage: designSettings.backgroundImage ? `url(${designSettings.backgroundImage})` : undefined,
                    backgroundSize: 'cover',
                    backgroundColor: '#ffffff', // Ensure white background
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '24px', // gap-6 = 24px
                    alignItems: 'flex-start',
                    minHeight: '200px', // Ensure minimum height
                    width: '600px', // Fixed width for consistency
                    boxSizing: 'border-box',
                    overflow: 'visible', // Ensure content is not clipped
                  }}
                >
                  {/* Photo - Center (shows at top) */}
                  {designSettings.photoPosition === 'center' && (
                    <div 
                      className="flex justify-center w-full"
                      style={{
                        paddingTop: `${designSettings.photoPaddingTop}px`,
                        order: -1, // Show photo first in center position
                      }}
                    >
                      <div 
                        className="bg-gray-200 overflow-hidden flex-shrink-0"
                        style={{ width: `${designSettings.photoWidth}px`, height: `${designSettings.photoWidth}px` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getPhotoUrl(student)}
                          alt={getStudentName(student)}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/default-avatar.svg';
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Photo - Left */}
                  {designSettings.photoPosition === 'left' && (
                    <div 
                      className="flex-shrink-0"
                      style={{
                        paddingTop: `${designSettings.photoPaddingTop}px`,
                      }}
                    >
                      <div 
                        className="bg-gray-200 overflow-hidden flex-shrink-0"
                        style={{ width: `${designSettings.photoWidth}px`, height: `${designSettings.photoWidth}px` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getPhotoUrl(student)}
                          alt={getStudentName(student)}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/default-avatar.svg';
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Content */}
                  <div 
                    className="flex-1"
                    style={{
                      fontSize: `${designSettings.fontSize}px`,
                      color: designSettings.textColor || '#000000', // Ensure black text as fallback
                      lineHeight: designSettings.lineHeight,
                      flex: 1,
                      minWidth: 0, // Allow flex shrinking
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      textAlign: designSettings.photoPosition === 'center' ? 'center' : 'left',
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
                  
                  {/* Photo - Right */}
                  {designSettings.photoPosition === 'right' && (
                    <div 
                      className="flex-shrink-0"
                      style={{
                        paddingTop: `${designSettings.photoPaddingTop}px`,
                      }}
                    >
                      <div 
                        className="bg-gray-200 overflow-hidden"
                        style={{ width: `${designSettings.photoWidth}px`, height: `${designSettings.photoWidth}px` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getPhotoUrl(student)}
                          alt={getStudentName(student)}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/default-avatar.svg';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Main UI - Hidden when printing */}
      <div className="container mx-auto py-6 space-y-6 print:hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <IdCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Student ID Card</h1>
            </div>
          </div>
          <Button 
            onClick={handleGenerate}
            disabled={selectedStudentIds.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Generate ID Card for Selected Students
          </Button>
        </div>
        
        {!showGeneratedCards ? (
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openImageDialog} title="Insert Image (drag to move, set size on upload)">
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
                      ID Card Template Content
                      <span className="text-xs text-muted-foreground ml-2">(Edit text, insert links & images here)</span>
                    </Label>
                    {showHtmlSource ? (
                      <textarea
                        className="min-h-[300px] p-4 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm w-full"
                        value={templateContent}
                        onChange={(e) => {
                          const content = e.target.value;
                          setTemplateContent(content);
                          debouncedUpdateContent(content);
                          if (editorRef.current) {
                            editorRef.current.innerHTML = content;
                          }
                        }}
                        placeholder="Enter your ID card template HTML..."
                      />
                    ) : (
                      <div
                        ref={(el) => {
                          if (el && el !== editorRef.current) {
                            editorRef.current = el;
                            // Set initial content if empty
                            if (!el.innerHTML || el.innerHTML === '') {
                              el.innerHTML = templateContent || DEFAULT_TEMPLATE;
                            }
                          }
                        }}
                        contentEditable
                        suppressContentEditableWarning
                        className="min-h-[300px] p-4 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        onInput={(e) => {
                          const content = (e.target as HTMLDivElement).innerHTML;
                          setTemplateContent(content);
                        }}
                        onBlur={(e) => {
                          const content = (e.target as HTMLDivElement).innerHTML;
                          setTemplateContent(content);
                        }}
                        data-placeholder="Click here to start editing your ID card template..."
                      />
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold">ℹ</span>
                      Type or paste content, use toolbar buttons for formatting, click Link/Image icons to insert media
                    </p>
                  </div>
                  
                  <Separator />
                  
                  {/* Substitutions Field Selector */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Insert Student Data Fields
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
                        Insert
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => selectedField && copyPlaceholder(selectedField)}
                        disabled={!selectedField}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <Info className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>How it works:</strong> Placeholders like <code className="px-1 py-0.5 bg-blue-100 rounded text-xs">__FULL_NAME__</code> will be automatically replaced with actual student data when you generate ID cards.
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
                    <Label className="text-sm font-medium">Background Image (.jpg, .png, .gif)</Label>
                    <Input 
                      type="file" 
                      accept=".jpg,.png,.gif"
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
                  </div>
                  
                  {/* Card Padding */}
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">CARD PADDING</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <Input 
                          type="number"
                          value={designSettings.cardPaddingTop}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, cardPaddingTop: parseInt(e.target.value) || 0 }))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground">Top and bottom (pixels)</span>
                      </div>
                      <div>
                        <Input 
                          type="number"
                          value={designSettings.cardPaddingLeft}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, cardPaddingLeft: parseInt(e.target.value) || 0 }))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground">Left and right (pixels)</span>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Text Padding */}
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">TEXT PADDING</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <Input 
                          type="number"
                          value={designSettings.textPaddingTop}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, textPaddingTop: parseInt(e.target.value) || 0 }))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground">Top and bottom (pixels)</span>
                      </div>
                      <div>
                        <Input 
                          type="number"
                          value={designSettings.textPaddingLeft}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, textPaddingLeft: parseInt(e.target.value) || 0 }))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground">Left and right (pixels)</span>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Photo Padding */}
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">PHOTO PADDING</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <Input 
                          type="number"
                          value={designSettings.photoPaddingTop}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, photoPaddingTop: parseInt(e.target.value) || 0 }))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground">Top and bottom (pixels)</span>
                      </div>
                      <div>
                        <Input 
                          type="number"
                          value={designSettings.photoPaddingLeft}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, photoPaddingLeft: parseInt(e.target.value) || 0 }))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground">Left and right (pixels)</span>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Photo Settings */}
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">PHOTO</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <Input 
                          type="number"
                          value={designSettings.photoWidth}
                          onChange={(e) => setDesignSettings(prev => ({ ...prev, photoWidth: parseInt(e.target.value) || 100 }))}
                          className="w-full"
                        />
                        <span className="text-xs text-muted-foreground">Max. width (pixels)</span>
                      </div>
                      <div>
                        <Select 
                          value={designSettings.photoPosition}
                          onValueChange={(value: "left" | "right" | "center") => setDesignSettings(prev => ({ ...prev, photoPosition: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="center">Center</SelectItem>
                            <SelectItem value="right">Right</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">Position</span>
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
                  
                  {/* Select All */}
                  <div className="flex items-center justify-between py-2 border-b">
                    <button
                      onClick={toggleAllStudents}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                    <div className="flex items-center gap-2">
                      {selectedGradeLevel === 'all' && selectedSection === 'all' && !searchQuery && (
                        <span className="text-xs text-muted-foreground">For preview only</span>
                      )}
                      <Badge variant="secondary">
                        {selectedGradeLevel === 'all' && selectedSection === 'all' && !searchQuery 
                          ? `${filteredStudents.length} of ${totalStudents} students`
                          : `${totalStudents} student${totalStudents !== 1 ? 's' : ''}`
                        }
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Info message when showing limited results */}
                  {selectedGradeLevel === 'all' && selectedSection === 'all' && !searchQuery && (
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                      <Info className="h-4 w-4 inline mr-2" />
                      Showing first 10 students as reference. Please select a specific grade level or section to view and generate ID cards for all students.
                    </div>
                  )}
                  
                  {/* Student List */}
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
                            <label
                              key={student.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={selectedStudentIds.includes(student.id)}
                                onCheckedChange={() => toggleStudent(student.id)}
                              />
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
                            </label>
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
                            <span>Showing first 10 students (select grade/section for more)</span>
                          ) : (
                            <span>
                              Showing {((currentPage - 1) * studentsPerPage) + 1} to {Math.min(currentPage * studentsPerPage, totalStudents)} of {totalStudents} students
                            </span>
                          )}
                        </div>
                        
                        {/* Show pagination when specific filter is selected */}
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
          /* Generated Cards View */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  To print in high quality (144dpi) and at true size, save the cards as an image, and print to 50% scale.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowGeneratedCards(false)}
                >
                  Back to Editor
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrint}
                  disabled={isGenerating}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button
                  onClick={handleExportImages}
                  disabled={isExporting}
                  className="bg-gray-700 hover:bg-gray-800"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isExporting ? 'Downloading ZIP...' : 'Convert Student ID Cards to Images'}
                </Button>
              </div>
            </div>
            
            <Separator />
            
            {/* Generated Cards */}
            <div 
              ref={cardsContainerRef}
              className="space-y-8"
            >
              {isGenerating ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                selectedStudents.map((student) => {
                  const processedContent = replacePlaceholders(templateContent, student);
                  
                  return (
                    <div 
                      key={student.id} 
                      className={`id-card-item flex gap-6 py-6 ${designSettings.photoPosition === 'center' ? 'flex-col items-center' : ''}`}
                      style={{
                        paddingTop: `${designSettings.cardPaddingTop}px`,
                        paddingBottom: `${designSettings.cardPaddingTop}px`,
                        paddingLeft: `${designSettings.cardPaddingLeft}px`,
                        paddingRight: `${designSettings.cardPaddingLeft}px`,
                        backgroundImage: designSettings.backgroundImage ? `url(${designSettings.backgroundImage})` : undefined,
                        backgroundSize: 'cover',
                      }}
                    >
                      {/* Photo - Center (shows at top) */}
                      {designSettings.photoPosition === 'center' && (
                        <div 
                          className="flex justify-center"
                          style={{
                            paddingTop: `${designSettings.photoPaddingTop}px`,
                          }}
                        >
                          <div 
                            className="bg-gray-200 overflow-hidden"
                            style={{ width: `${designSettings.photoWidth}px`, height: `${designSettings.photoWidth}px` }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getPhotoUrl(student)}
                              alt={getStudentName(student)}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/images/default-avatar.svg';
                              }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Photo - Left */}
                      {designSettings.photoPosition === 'left' && (
                        <div 
                          className="flex-shrink-0"
                          style={{
                            paddingTop: `${designSettings.photoPaddingTop}px`,
                            paddingLeft: `${designSettings.photoPaddingLeft}px`,
                          }}
                        >
                          <div 
                            className="bg-gray-200 overflow-hidden"
                            style={{ width: `${designSettings.photoWidth}px`, height: `${designSettings.photoWidth}px` }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getPhotoUrl(student)}
                              alt={getStudentName(student)}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/images/default-avatar.svg';
                              }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Content */}
                      <div 
                        className="flex-1"
                        style={{
                          paddingTop: `${designSettings.textPaddingTop}px`,
                          paddingLeft: `${designSettings.textPaddingLeft}px`,
                        }}
                      >
                        <div dangerouslySetInnerHTML={{ __html: processedContent }} />
                      </div>
                      
                      {/* Photo - Right */}
                      {designSettings.photoPosition === 'right' && (
                        <div 
                          className="flex-shrink-0"
                          style={{
                            paddingTop: `${designSettings.photoPaddingTop}px`,
                            paddingRight: `${designSettings.photoPaddingLeft}px`,
                          }}
                        >
                          <div 
                            className="bg-gray-200 overflow-hidden"
                            style={{ width: `${designSettings.photoWidth}px`, height: `${designSettings.photoWidth}px` }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getPhotoUrl(student)}
                              alt={getStudentName(student)}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/images/default-avatar.svg';
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Editor and Print Styles */}
      <style jsx global>{`
        /* Editor link styles - make links visible in contentEditable */
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
        
        /* Editor image styles - draggable and resizable */
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
        
        /* Dragging feedback */
        [contenteditable] img:active {
          opacity: 0.7;
          cursor: grabbing;
        }
        
        @media print {
          /* Hide layout and UI elements */
          header, nav, aside, .sidebar, .topbar, .navbar, .navigation {
            display: none !important;
          }
          
          /* Hide toast notifications and alerts */
          .toast, .notification, .alert, [role="alert"], [role="status"],
          .sonner-toast, .sonner-toaster, .toaster, [data-sonner-toaster],
          [data-radix-toast], [data-radix-portal] {
            display: none !important;
          }
          
          /* Hide UI components */
          button, .button, input, select, textarea, .modal, .dialog,
          .overlay, .dropdown, .menu, .tooltip, .popover, .card,
          .badge, .avatar, .icon, .spinner, .loader, .checkbox,
          .radio, .switch, .tabs, .accordion, .select {
            display: none !important;
          }
          
          /* Hide main UI containers */
          .container, .print\\:hidden {
            display: none !important;
          }
          
          /* Show and position print area */
          .id-card-print-area {
            display: block !important;
            position: static !important;
            visibility: visible !important;
            width: 100% !important;
            height: auto !important;
          }
          
          /* Ensure all print area children are visible */
          .id-card-print-area *,
          .id-card-print-area *::before,
          .id-card-print-area *::after {
            display: block !important;
            visibility: visible !important;
            position: static !important;
          }
          
          /* ID card specific styles */
          .id-card-item {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 20px !important;
            display: block !important;
            visibility: visible !important;
          }
          
          /* Page setup */
          @page {
            margin: 0.5in;
            size: auto;
          }
          
          /* Preserve colors */
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
              Add a hyperlink to your ID card template
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
              Add an image to your ID card template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
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
              <Label htmlFor="image-file">Upload Image</Label>
              <Input
                id="image-file"
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
              <Label htmlFor="image-alt">Image Description (Alt Text)</Label>
              <Input
                id="image-alt"
                type="text"
                placeholder="Description of the image"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="image-width">Width (px) - Optional</Label>
                <Input
                  id="image-width"
                  type="number"
                  placeholder="Auto"
                  value={imageWidth}
                  onChange={(e) => setImageWidth(e.target.value)}
                  className="mt-1"
                  min="10"
                />
              </div>
              <div>
                <Label htmlFor="image-height">Height (px) - Optional</Label>
                <Input
                  id="image-height"
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
            <DialogTitle>Editor - Fullscreen Mode</DialogTitle>
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
