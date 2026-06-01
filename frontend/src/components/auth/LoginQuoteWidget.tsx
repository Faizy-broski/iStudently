"use client";

import { useState, useEffect } from "react";
import { getCurrentQuote, type LoginQuote } from "@/lib/api/quotes";
import { useTranslations } from "next-intl";

interface LoginQuoteWidgetProps {
  locale?: "en" | "ar";
}

export function LoginQuoteWidget({ locale = "en" }: LoginQuoteWidgetProps) {
  const [quote, setQuote] = useState<LoginQuote | null>(null);
  const t = useTranslations("login_quote_widget");
  const isArabic = locale === "ar";

  useEffect(() => {
    getCurrentQuote().then(setQuote).catch(() => {});
  }, []);

  if (!quote) return null;

  const text = isArabic ? quote.text_ar : quote.text_en;
  if (!text?.trim()) return null;

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      style={{
        marginTop: "2rem",
        position: "relative",
        padding: "1.75rem 2rem 1.5rem",
        borderRadius: "16px",
        background: "linear-gradient(135deg, rgba(1,45,110,0.06) 0%, rgba(1,45,110,0.02) 100%)",
        border: "1px solid rgba(1,45,110,0.18)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          [isArabic ? "right" : "left"]: 0,
          width: "4px",
          height: "100%",
          background: "linear-gradient(180deg, #022172 0%, #57A3CC 100%)",
          borderRadius: isArabic ? "0 16px 16px 0" : "16px 0 0 16px",
        }}
      />

      <span
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "64px",
          lineHeight: "0.6",
          color: "rgba(1,45,110,0.18)",
          display: "block",
          marginBottom: "0.5rem",
          fontStyle: "italic",
          textAlign: isArabic ? "right" : "left",
        }}
      >
        {isArabic ? "،،" : "\u201C"}
      </span>

      <p
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "15px",
          fontStyle: "italic",
          lineHeight: "1.75",
          color: "#1a2f5a",
          margin: "0 0 0.75rem 0",
          textAlign: isArabic ? "right" : "left",
        }}
      >
        {text}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexDirection: isArabic ? "row-reverse" : "row",
        }}
      >
        <div
          style={{
            flex: 1,
            height: "1px",
            background: isArabic
              ? "linear-gradient(270deg, rgba(1,45,110,0.25) 0%, transparent 100%)"
              : "linear-gradient(90deg, rgba(1,45,110,0.25) 0%, transparent 100%)",
          }}
        />
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(1,45,110,0.45)",
          }}
        >
          {t("quote_label")}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#022172"
          strokeWidth="1.5"
          style={{ opacity: 0.3 }}
        >
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      </div>
    </div>
  );
}