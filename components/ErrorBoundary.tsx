"use client";

import { Component, ReactNode, CSSProperties } from "react";

/**
 * مكوّن ErrorBoundary يلتقط أي استثناء يحدث داخل شجرته
 * ويعرض واجهة سهلة الفهم مع زر لإعادة المحاولة.
 */
type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    // يمكن توجيه الأخطاء إلى أدوات التحليل هنا
    console.error("[ErrorBoundary] تم التقاط خطأ:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div style={fallbackStyle as CSSProperties}>
            <h2>حدث خطأ غير متوقع</h2>
            <p>{this.state.error?.message ?? "يرجى المحاولة مرة أخرى"}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              style={buttonStyle as CSSProperties}
            >
              إعادة المحاولة
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// أنماط بسيطة للواجهة الافتراضية
const fallbackStyle = {
  padding: "2rem",
  textAlign: "center",
  direction: "rtl"
};

const buttonStyle = {
  marginTop: "1rem",
  padding: "0.5rem 1rem",
  cursor: "pointer"
};