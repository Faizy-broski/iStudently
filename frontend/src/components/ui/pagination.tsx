import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { ButtonProps, buttonVariants } from "@/components/ui/button"

const Pagination = ({ className, ...props }: React.ComponentProps<"nav">) => (
  <nav
    role="navigation"
    aria-label="pagination"
    className={cn("mx-auto flex w-full justify-center", className)}
    {...props}
  />
)
Pagination.displayName = "Pagination"

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
))
PaginationContent.displayName = "PaginationContent"

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn("", className)} {...props} />
))
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
  isActive?: boolean
} & Pick<ButtonProps, "size"> &
  React.ComponentProps<"a">

const PaginationLink = ({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? "page" : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className
    )}
    {...props}
  />
)
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to previous page"
    size="default"
    className={cn("gap-1 pl-2.5", className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>Previous</span>
  </PaginationLink>
)
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="Go to next page"
    size="default"
    className={cn("gap-1 pr-2.5", className)}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
)
PaginationNext.displayName = "PaginationNext"

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<"span">) => (
  <span
    aria-hidden
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
)
PaginationEllipsis.displayName = "PaginationEllipsis"

// Reusable Pagination Wrapper Component
interface PaginationWrapperProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  variant?: "default" | "gradient";
}

const PaginationWrapper = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  variant = "default"
}: PaginationWrapperProps) => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    
    // Always show first page
    pages.push(1);
    
    // Calculate range around current page
    const rangeStart = Math.max(2, currentPage - 1);
    const rangeEnd = Math.min(totalPages - 1, currentPage + 1);
    
    // Add ellipsis after first page if needed
    if (rangeStart > 2) {
      pages.push("ellipsis");
    }
    
    // Add pages around current page
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }
    
    // Add ellipsis before last page if needed
    if (rangeEnd < totalPages - 1) {
      pages.push("ellipsis");
    }
    
    // Always show last page if there's more than 1 page
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };

  if (totalItems === 0) return null;

  const linkClass = variant === "gradient" 
    ? "hover-gradient-blue transition-all duration-300"
    : "";
  
  const activeLinkClass = variant === "gradient"
    ? "gradient-blue text-white"
    : "";

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-gray-600">
        Showing {startIndex + 1} to {endIndex} of {totalItems} {totalItems === 1 ? 'entry' : 'entries'}
      </p>
      
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : linkClass}
            />
          </PaginationItem>
          
          {getPageNumbers().map((page, index) => {
            if (page === "ellipsis") {
              return (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }
            
            return (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => onPageChange(page)}
                  isActive={currentPage === page}
                  className={currentPage === page ? activeLinkClass : linkClass}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          
          <PaginationItem>
            <PaginationNext 
              onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : linkClass}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
PaginationWrapper.displayName = "PaginationWrapper"

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationWrapper,
}
