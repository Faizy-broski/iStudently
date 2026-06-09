'use client';

import { LibraryInventory } from "@/components/admin/library/LibraryInventory";

export default function AdminLibraryBooksPage() {
    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6 text-[#022172] dark:text-white">Books Management</h1>
            <LibraryInventory />
        </div>
    );
}
