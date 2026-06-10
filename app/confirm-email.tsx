import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';

export default function ConfirmEmail() {
  const [message, setMessage] = useState('جاري التحقق من البريد الإلكتروني...');

  useEffect(() => {
    const checkVerification = async () => {
      if (!auth.currentUser) {
        setMessage('لم يتم تسجيل الدخول. يرجى تسجيل الدخول أولاً.');
        return;
      }
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        // Redirect to home or desired page after successful verification
        window.location.href = '/home';
      } else {
        setMessage('لم يتم تأكيد البريد الإلكتروني بعد. يرجى التحقق من بريدك الوارد والنقر على رابط التفعيل.');
      }
    };
    checkVerification();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-4">تأكيد البريد الإلكتروني</h1>
      <p className="text-lg">{message}</p>
    </div>
  );
}