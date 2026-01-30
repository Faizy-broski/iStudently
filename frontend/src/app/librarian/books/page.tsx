'use client';

import { LibraryInventory } from "@/components/admin/library/LibraryInventory";

// This page manages the books inventory
export default function LibrarianBooksPage() {
    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6 text-[#022172]">Books Management</h1>
            <LibraryInventory />
        </div>
    );
}
