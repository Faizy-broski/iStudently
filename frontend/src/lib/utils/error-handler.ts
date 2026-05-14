import { toast } from "sonner";

/**
 * Handles API errors and shows appropriate toast notifications
 * @param error - The error object from the API call
 */
export function handleApiError(error: any): void {
  const errorMessage = error.message || "An unexpected error occurred";

  // Check for error codes from backend
  if (errorMessage.startsWith("DUPLICATE_SLUG:")) {
    toast.error("School slug already exists", {
      description: "Please choose a different school slug. This one is already in use."
    });
  } else if (errorMessage.startsWith("DUPLICATE_EMAIL:")) {
    toast.error("Contact email already in use", {
      description: "A school with this contact email already exists. Please use a different email."
    });
  } else if (errorMessage.startsWith("DUPLICATE_ENTRY:")) {
    toast.error("Duplicate entry", {
      description: errorMessage.replace("DUPLICATE_ENTRY:", "").trim()
    });
  } else if (errorMessage.startsWith("EMAIL_EXISTS:")) {
    toast.error("Admin email already registered", {
      description: "This email address is already in use. Please use a different email for the admin account."
    });
  } else if (errorMessage.startsWith("INVALID_EMAIL:")) {
    toast.error("Invalid email", {
      description: "Please provide a valid email address."
    });
  } else if (errorMessage.startsWith("PASSWORD_ERROR:")) {
    toast.error("Password requirement not met", {
      description: errorMessage.replace("PASSWORD_ERROR:", "").trim()
    });
  } else if (errorMessage.startsWith("INVALID_REFERENCE:")) {
    toast.error("Invalid reference", {
      description: "A referenced record does not exist."
    });
  } else if (errorMessage.startsWith("MISSING_REQUIRED:")) {
    toast.error("Missing required field", {
      description: "Please fill in all required fields."
    });
  } else if (errorMessage.startsWith("AUTH_ERROR:")) {
    toast.error("Authentication error", {
      description: errorMessage.replace("AUTH_ERROR:", "").trim()
    });
  } else if (errorMessage.includes("permission denied")) {
    toast.error("Permission denied", {
      description: "You don't have permission to perform this action. Please contact support."
    });
  } else if (errorMessage.includes("User profile not found")) {
    toast.error("Authentication error", {
      description: "Please log out and log back in."
    });
  } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    toast.error("Network error", {
      description: "Please check your internet connection and try again."
    });
  } else {
    toast.error("Operation failed", {
      description: errorMessage
    });
  }
}