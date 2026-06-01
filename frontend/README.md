# Studently Frontend - Multi-Role Architecture

## 📂 Directory Structure (Inside `src/`)

All source code is organized under the `src/` directory following Next.js 14 best practices.

### `/src/app` - Next.js App Router

Route structure with role-based prefixes:

```
app/
├── (auth)/              # Auth routes (no URL prefix)
│   ├── login/           → /login
│   ├── register/        → /register
│   └── forgot-password/ → /forgot-password
│
├── superadmin/          # SuperAdmin routes
│   ├── dashboard/       → /superadmin/dashboard
│   ├── school-directory/→ /superadmin/school-directory
│   └── billing-status/  → /superadmin/billing-status
│
├── admin/               # School Admin routes
│   ├── dashboard/       → /admin/dashboard
│   ├── teachers/        → /admin/teachers
│   └── students/        → /admin/students
│
├── teacher/             # Teacher routes
│   ├── dashboard/       → /teacher/dashboard
│   ├── classes/         → /teacher/classes
│   └── gradebook/       → /teacher/gradebook
│
├── student/             # Student routes
│   ├── dashboard/       → /student/dashboard
│   ├── classes/         → /student/classes
│   └── gradebook/       → /student/gradebook
│
└── parent/              # Parent routes
    ├── dashboard/       → /parent/dashboard
    ├── children/        → /parent/children
    └── gradebook/       → /parent/gradebook
```

### `/src/components` - Reusable Components

Feature-based component organization:

```
components/
├── shared/              # Shared across all roles
│   ├── ui/             # Base UI components (shadcn)
│   ├── Navbar.tsx
│   └── Sidebar.tsx
│
├── layouts/             # Role-specific layouts
│   ├── SuperAdminLayout.tsx
│   ├── AdminLayout.tsx
│   ├── TeacherLayout.tsx
│   ├── StudentLayout.tsx
│   └── ParentLayout.tsx
│
├── gradebook/          # Gradebook feature
│   ├── GradebookTable.tsx
│   ├── GradeCell.tsx
│   └── GradeStats.tsx
│
└── dashboard/          # Dashboard widgets
    ├── StatsCard.tsx
    └── RecentActivity.tsx
```

### `/src/hooks` - Custom React Hooks

SWR-based data fetching hooks:

```
hooks/
├── useAuth.ts           # Authentication state
├── useGradebook.ts      # Gradebook data
├── useSchools.ts        # Schools data (SuperAdmin)
├── useBilling.ts        # Billing data (SuperAdmin)
└── useStudents.ts       # Student data
```

### `/src/lib` - Utilities & Services

```
lib/
├── supabase/
│   ├── client.ts        # Client-side Supabase
│   └── server.ts        # Server-side Supabase
│
├── api/                 # API wrappers
│   ├── schools.ts
│   ├── billing.ts
│   └── dashboard.ts
│
└── utils/
    └── error-handler.ts
```

### `/src/middleware.ts` - Route Protection

**CRITICAL**: This file must be at `src/` root (Next.js requirement)

Handles:
- Authentication checks
- Role-based redirects
- Cross-role access prevention
- User metadata in headers

## 🎯 Import Path Aliases

Configured in `tsconfig.json`:

```typescript
// Components
import { Button } from '@/components/ui/Button';
import { GradebookTable } from '@/components/gradebook/GradebookTable';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useGradebook } from '@/hooks/useGradebook';

// Libraries
import { supabase } from '@/lib/supabase/client';
import { schoolApi } from '@/lib/api/schools';

// Types
import type { School } from '@/types';

// Context
import { useAuth } from '@/context/AuthContext';

// Config
import { sidebarConfig } from '@/config/sidebar';
```

## 🔐 Authentication Flow

### 1. Login Component
```typescript
// app/(auth)/login/page.tsx
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { signIn } = useAuth();
  
  const handleLogin = async () => {
    const { data } = await signIn(email, password);
    // Middleware handles redirect based on role
  };
}
```

### 2. Middleware Protection
```typescript
// src/middleware.ts
// Automatically:
// - Checks session
// - Validates role
// - Redirects to correct dashboard
```

### 3. Role-Specific Pages
```typescript
// app/teacher/dashboard/page.tsx
// User is guaranteed to be authenticated teacher
// Can safely access teacher-specific data
```

## 🎨 Component Sharing Strategy

### Problem: Same feature, different roles
Teacher, Student, and Parent all need to see "Gradebook"

### Solution: Feature-based components with role props

```typescript
// components/gradebook/GradebookTable.tsx
interface Props {
  grades: Grade[];
  editable?: boolean;      // Only teachers can edit
  studentName?: string;    // For parent/teacher viewing specific student
}

// app/teacher/gradebook/page.tsx
<GradebookTable grades={data} editable={true} />

// app/student/gradebook/page.tsx  
<GradebookTable grades={data} />

// app/parent/gradebook/page.tsx
<GradebookTable grades={data} studentName="John Doe" />
```

## 📦 Adding New Features

### Example: Adding "Attendance" Feature

1. **Create shared component**
   ```
   components/attendance/AttendanceCalendar.tsx
   components/attendance/AttendanceTable.tsx
   ```

2. **Create role-specific pages**
   ```
   app/teacher/attendance/page.tsx  (mark attendance)
   app/student/attendance/page.tsx  (view own)
   app/parent/attendance/page.tsx   (view children)
   ```

3. **Create SWR hook**
   ```
   hooks/useAttendance.ts
   ```

4. **Create API wrapper**
   ```
   lib/api/attendance.ts
   ```

## 🚀 Development Workflow

### Starting Development
```bash
npm run dev  # Runs on http://localhost:3000
```

### File Structure Commands
```bash
# Navigate to feature
cd src/app/teacher/gradebook

# Create new component
touch src/components/gradebook/NewComponent.tsx

# Create new hook
touch src/hooks/useNewFeature.ts
```

### URL Testing
```
http://localhost:3000/login              # Auth page
http://localhost:3000/superadmin/dashboard  # SuperAdmin
http://localhost:3000/teacher/dashboard     # Teacher
http://localhost:3000/student/dashboard     # Student
```

## ⚠️ Common Mistakes to Avoid

### ❌ Wrong: Creating role-specific components
```typescript
components/teacher/TeacherGradebook.tsx
components/student/StudentGradebook.tsx
// Result: Code duplication
```

### ✅ Right: Feature-based with role props
```typescript
components/gradebook/GradebookTable.tsx
// Used by all roles with different props
```

### ❌ Wrong: Using absolute paths
```typescript
import { Button } from '../../../components/ui/Button';
```

### ✅ Right: Using path aliases
```typescript
import { Button } from '@/components/ui/Button';
```

### ❌ Wrong: Accessing other roles' routes
```typescript
// Teacher trying to access admin route
router.push('/admin/dashboard'); // Middleware blocks this
```

### ✅ Right: Use role-aware navigation
```typescript
const { role } = useAuth();
router.push(`/${role}/dashboard`); // Goes to correct dashboard
```

## 🔧 Configuration Files

### `tsconfig.json`
- Defines path aliases
- TypeScript compilation settings

### `next.config.js`
- Next.js configuration
- Environment variables
- Image domains

### `tailwind.config.ts`
- Tailwind CSS customization
- Theme colors
- Custom utilities

## 📚 Further Reading

- [Next.js App Router](https://nextjs.org/docs/app)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [SWR Documentation](https://swr.vercel.app/)
- [Shadcn/ui](https://ui.shadcn.com/)
