"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { X, Copy, Download, Printer, Eye, EyeOff } from "lucide-react";
import html2canvas from "html2canvas";
import QRCode from "react-qr-code";

const LOGIN_URL = "https://www.istudent.ly";

export interface AdminCredentialsCardData {
  schoolName: string;
  logoUrl?: string | null;
  adminName: string;
  adminEmail: string;
  username: string;
  password: string;
}

interface AdminCredentialsCardProps {
  data: AdminCredentialsCardData;
  onClose: () => void;
}

// Rendered with inline styles only (no Tailwind classes) inside the printable
// area — html2canvas can't parse Tailwind v4's oklch/lab color functions, and
// plain inline hex/rgb styles sidestep that entirely.
export default function AdminCredentialsCard({ data, onClose }: AdminCredentialsCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  const copyToClipboard = () => {
    const text = `School: ${data.schoolName}\nAdmin: ${data.adminName}\nUsername: ${data.username}\nPassword: ${data.password}\nLogin: ${LOGIN_URL}`;
    navigator.clipboard.writeText(text).then(
      () => toast.success("Credentials copied to clipboard"),
      () => toast.error("Failed to copy credentials")
    );
  };

  const downloadAsImage = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `${data.schoolName.replace(/\s+/g, "-").toLowerCase()}-admin-credentials.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to generate credentials card image:", error);
      toast.error("Failed to download credentials card");
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:bg-white print:p-0">
      <div className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none print:max-h-none">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 print:hidden">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Admin Credentials</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 print:p-0">
          <div
            ref={cardRef}
            style={{
              background: "linear-gradient(135deg, #022172 0%, #57A3CC 100%)",
              borderRadius: 12,
              padding: 24,
              color: "#ffffff",
              fontFamily: "Arial, Helvetica, sans-serif",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              {data.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.logoUrl}
                  alt={data.schoolName}
                  style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", background: "#ffffff" }}
                />
              )}
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{data.schoolName}</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>Administrator Login Credentials</div>
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: 16,
                display: "flex",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, opacity: 0.75 }}>Name</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{data.adminName}</div>

                <div style={{ fontSize: 11, opacity: 0.75 }}>Username</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{data.username}</div>

                <div style={{ fontSize: 11, opacity: 0.75 }}>Password</div>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>
                  {showPassword ? data.password : "•".repeat(data.password.length)}
                </div>
              </div>
              <div style={{ background: "#ffffff", padding: 6, borderRadius: 6 }}>
                <QRCode value={LOGIN_URL} size={72} bgColor="#ffffff" fgColor="#000000" />
              </div>
            </div>

            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 12, textAlign: "center" }}>{LOGIN_URL}</div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-3 print:hidden">
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 print:hidden">
            <Button type="button" variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadAsImage}>
              <Download className="h-4 w-4 mr-1" /> Download
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
