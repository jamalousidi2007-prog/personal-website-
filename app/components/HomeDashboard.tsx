"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ChangeEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp
} from "firebase/firestore";
import { useLanguage } from "./LanguageProvider";
import { useAuth, type UserRole } from "./auth/AuthProvider";
import ImageLightbox from "./ImageLightbox";
import EditableText from "./InlineEdit";
import { getFirebaseDb } from "@/lib/firebase/client";
import { SUPER_ADMIN_EMAIL } from "@/lib/constants";
import { emailToKey } from "@/lib/emailKey";
import {
  defaultProjectBackgrounds,
  defaultProjectImages,
  defaultProjectImageStyles,
  PROJECT_BG_STORAGE_KEY,
  PROJECT_IMAGE_STORAGE_KEY,
  PROJECT_IMAGE_SECONDARY_STORAGE_KEY,
  PROJECT_IMAGE_STYLE_STORAGE_KEY,
  type ProjectId
} from "@/lib/projectVisuals";
import styles from "./HomeDashboard.module.css";

const PROFILE_IMAGE_STORAGE_KEY = "personal_profile_image";
const DEFAULT_PROFILE_IMAGE = "/images/profile.jpg";

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  banned: boolean;
  deleted?: boolean;
  status: "online" | "offline";
  lastSeen: string;
};

type ChatMessage = {
  id: string;
  text: string;
  senderEmail: string;
  receiverEmail: string;
  systemOnlyFor?: string | null;
  createdAt: Timestamp | null;
};

type BgProject = ProjectId;

type BgPreset = {
  id: string;
  label: string;
  value: string;
};

const defaultBgPresets: BgPreset[] = [
  { id: "sunny", label: "Sunny", value: "linear-gradient(135deg,#1d4ed8,#0ea5e9,#22c55e,#0f172a)" },
  { id: "cloudy", label: "Cloudy", value: "linear-gradient(135deg,#94a3b8,#475569,#1e293b,#0f172a)" },
  { id: "rainy", label: "Rainy", value: "linear-gradient(135deg,#0ea5e9,#2563eb,#1e3a8a,#0f172a)" },
  { id: "night", label: "Night", value: "linear-gradient(135deg,#312e81,#1e1b4b,#0a0f2f,#050816)" },
  { id: "coast", label: "Coast", value: "linear-gradient(135deg,#67e8f9,#0ea5e9,#2563eb,#0f172a)" },
  { id: "desert", label: "Desert", value: "linear-gradient(135deg,#fb923c,#ea580c,#9a3412,#0f172a)" }
];

const copy = {
  ar: {
    brand: "مشاريع المهندس جمال اوسيدي",
    subtitle:
      "منصة احترافية لمشاريع ESP32 الذكية، لعرض المشاريع، مراقبة المستشعرات، التحكم عن بعد، وتحليل البيانات المباشرة بطريقة منظمة وحديثة.",
    users: "المستخدمون",
    chats: "المحادثات",
    backgrounds: "الخلفيات",
    home: "الرئيسية",
    logout: "تسجيل الخروج",
    projectLabel: ["المشروع الأول", "المشروع الثاني", "المشروع الثالث", "المشروع الرابع"],
    projectTitle: ["Station Meteo", "Smart Irrigation", "Energy Monitor", "Home Security"],
    projectDesc: [
      "أول مشروع تجريبي مرتبط بـ ESP32 مع بيانات حية",
      "نظام سقي ذكي يعتمد على رطوبة التربة والجدولة",
      "مراقبة استهلاك الطاقة والتنبيهات عند الأحمال العالية",
      "نظام أمان منزلي مع حساسات حركة وإشعارات فورية"
    ],
    usersTitle: "إدارة المستخدمين والصلاحيات",
    chatsTitle: "المحادثات الخاصة",
    chatsSelectUser: "اختر مستخدمًا لبدء المحادثة",
    chatsNoUsers: "لا يوجد مستخدمون آخرون متاحون للمحادثة بعد",
    chatsWrite: "اكتب رسالتك...",
    chatsSend: "إرسال",
    chatsBlock: "حظر",
    chatsUnblock: "إلغاء الحظر",
    chatsBlockedByMe: "هذا المستخدم محظور من طرفك داخل هذه المحادثة",
    chatsBlockedYou: "لا يمكنك إرسال رسالة لأن هذا المستخدم قام بحظرك",
    chatsDeleteMessage: "حذف الرسالة",
    chatsDeleteThread: "حذف المحادثة",
    backgroundsTitle: "إدارة الخلفيات",
    back: "رجوع",
    delete: "حذف",
    addUser: "إضافة مستخدم",
    email: "البريد الإلكتروني",
    role: "الصلاحية",
    roleViewer: "مشاهد",
    roleAdmin: "مشرف",
    roleSuper: "Super Admin",
    ban: "حظر",
    unban: "إلغاء الحظر",
    banned: "محظور",
    connectedNow: "متصل الآن",
    active: "نشط",
    noPermission: "لا تملك صلاحية تعديل المستخدمين",
    authOnly: "الوصول للمحتوى يتطلب تسجيل الدخول",
    added: "تمت إضافة المستخدم بنجاح",
    licenses: "الرخص"
  },
  fr: {
    brand: "Projets de l'ingenieur Jamal Ousidi",
    subtitle:
      "Plateforme professionnelle ESP32 pour presenter les projets, surveiller les capteurs, controler a distance et analyser les donnees en direct.",
    users: "Utilisateurs",
    chats: "Discussions",
    backgrounds: "Arriere-plans",
    home: "Accueil",
    logout: "Deconnexion",
    projectLabel: ["Projet 1", "Projet 2", "Projet 3", "Projet 4"],
    projectTitle: ["Station Meteo", "Smart Irrigation", "Energy Monitor", "Home Security"],
    projectDesc: [
      "Premier projet pilote connecte a ESP32 avec donnees live",
      "Systeme d'irrigation intelligent base sur l'humidite du sol",
      "Suivi de consommation electrique avec alertes de surcharge",
      "Securite domestique avec detecteurs de mouvement et notifications"
    ],
    usersTitle: "Gestion des utilisateurs et des roles",
    chatsTitle: "Messagerie privee",
    chatsSelectUser: "Choisissez un utilisateur pour demarrer",
    chatsNoUsers: "Aucun autre utilisateur disponible pour le moment",
    chatsWrite: "Ecrivez votre message...",
    chatsSend: "Envoyer",
    chatsBlock: "bloquer",
    chatsUnblock: "debloquer",
    chatsBlockedByMe: "Cet utilisateur est bloque par vous dans cette discussion",
    chatsBlockedYou: "Vous ne pouvez pas envoyer: cet utilisateur vous a bloque",
    chatsDeleteMessage: "Supprimer message",
    chatsDeleteThread: "Supprimer discussion",
    backgroundsTitle: "Gestion des arriere-plans",
    back: "Retour",
    delete: "Supprimer",
    addUser: "Ajouter utilisateur",
    email: "E-mail",
    role: "Role",
    roleViewer: "Lecteur",
    roleAdmin: "Admin",
    roleSuper: "Super Admin",
    ban: "Bloquer",
    unban: "Debloquer",
    banned: "Bloque",
    connectedNow: "En ligne maintenant",
    active: "Actif",
    noPermission: "Vous n'avez pas le droit de modifier les utilisateurs",
    authOnly: "L'acces au contenu exige une authentification",
    added: "Utilisateur ajoute avec succes",
    licenses: "Licences"
  },
  en: {
    brand: "Engineer Jamal Ousidi Projects",
    subtitle:
      "A professional ESP32 platform to present projects, monitor sensors, control devices remotely, and analyze live data in a modern organized way.",
    users: "Users",
    chats: "Chats",
    backgrounds: "Backgrounds",
    home: "Home",
    logout: "Logout",
    projectLabel: ["Project 1", "Project 2", "Project 3", "Project 4"],
    projectTitle: ["Station Meteo", "Smart Irrigation", "Energy Monitor", "Home Security"],
    projectDesc: [
      "First pilot project connected to ESP32 with live data",
      "Smart irrigation using soil moisture readings and schedules",
      "Live power consumption monitoring with high-load alerts",
      "Home security with motion sensors and instant notifications"
    ],
    usersTitle: "Users and Roles Management",
    chatsTitle: "Private Chats",
    chatsSelectUser: "Choose a user to start chatting",
    chatsNoUsers: "No other users are available to chat yet",
    chatsWrite: "Write your message...",
    chatsSend: "Send",
    chatsBlock: "Block",
    chatsUnblock: "Unblock",
    chatsBlockedByMe: "You blocked this user in this chat",
    chatsBlockedYou: "You cannot send because this user blocked you",
    chatsDeleteMessage: "Delete message",
    chatsDeleteThread: "Delete chat",
    backgroundsTitle: "Background Manager",
    back: "Back",
    delete: "Delete",
    addUser: "Add User",
    email: "Email",
    role: "Role",
    roleViewer: "Viewer",
    roleAdmin: "Admin",
    roleSuper: "Super Admin",
    ban: "Ban",
    unban: "Unban",
    banned: "Banned",
    connectedNow: "Online now",
    active: "Active",
    noPermission: "You do not have permission to modify users",
    authOnly: "Content access requires authentication",
    added: "User added successfully",
    licenses: "Licenses"
  }
};

const projectLinks = ["/projects/station-meteo", "/projects/smart-irrigation", "/projects/energy-monitor", "/projects/home-security"];

export default function HomeDashboard() {
  const { lang } = useLanguage();
  const t = copy[lang];
  const { role, signOutUser, configured, user } = useAuth();

  const [tab, setTab] = useState<"home" | "users" | "chats" | "backgrounds">("home");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [photoError, setPhotoError] = useState(false);
  const [profileImage, setProfileImage] = useState(DEFAULT_PROFILE_IMAGE);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("viewer");
  const [notice, setNotice] = useState("");
  const [bgPresets, setBgPresets] = useState<BgPreset[]>(defaultBgPresets);
  const [selectedPresetId, setSelectedPresetId] = useState(defaultBgPresets[0].id);
  const [selectedProject, setSelectedProject] = useState<BgProject>(1);
  const [bgNotice, setBgNotice] = useState("");
  const [projectImages, setProjectImages] = useState<Record<ProjectId, string>>(defaultProjectImages);
  const [projectSecondaryImages, setProjectSecondaryImages] = useState<Partial<Record<ProjectId, string>>>({});
  const [projectImageStyles, setProjectImageStyles] = useState(defaultProjectImageStyles);
  const [projectPreview, setProjectPreview] = useState<{ src: string; alt: string } | null>(null);
  const [selectedChatEmail, setSelectedChatEmail] = useState("");
  const [chatThreadEmails, setChatThreadEmails] = useState<string[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatBlockedByMe, setChatBlockedByMe] = useState(false);
  const [chatBlockedMe, setChatBlockedMe] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [draftImage, setDraftImage] = useState<string | null>(null);
  const [draftProject, setDraftProject] = useState<ProjectId | null>(null);
  const [draftStyle, setDraftStyle] = useState(defaultProjectImageStyles[1]);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const quickProjectInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const projectClickTimers = useRef<Partial<Record<ProjectId, number>>>({});
  const profileInputRef = useRef<HTMLInputElement | null>(null);
  const dragStateRef = useRef<{ dragging: boolean; x: number; y: number }>({ dragging: false, x: 0, y: 0 });
  const draftFrameRef = useRef<HTMLDivElement | null>(null);
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);

  const canOpenUsers = role === "superadmin";
  const canOpenChats = Boolean(user);
  const canEditRoles = role === "superadmin";
  const canDeleteUsers = role === "superadmin";
  const canAddUsers = role === "superadmin";
  const canManageBackgrounds = role === "superadmin";
  const canEditText = role === "superadmin";
  const myEmail = user?.email?.toLowerCase() || "";
  const ownerEmail = SUPER_ADMIN_EMAIL.toLowerCase();
  const currentUserRow = useMemo<UserRow | null>(() => {
    if (!myEmail) return null;
    return {
      id: emailToKey(myEmail),
      email: myEmail,
      role: (role ?? "viewer") as UserRole,
      banned: false,
      status: "online",
      lastSeen: t.connectedNow
    };
  }, [myEmail, role, t.connectedNow]);
  const visibleUsers = useMemo(() => {
    if (canEditRoles) {
      const merged = currentUserRow ? [currentUserRow, ...users] : [...users];
      return merged
        .filter((row) => !row.deleted)
        .filter((row, index, arr) => arr.findIndex((item) => item.email.toLowerCase() === row.email.toLowerCase()) === index);
    }
    return currentUserRow ? [currentUserRow] : [];
  }, [canEditRoles, currentUserRow, users]);

  useEffect(() => {
    if (!canOpenUsers && tab === "users") {
      setTab("home");
    }
  }, [canOpenUsers, tab]);

  useEffect(() => {
    if (!canManageBackgrounds && tab === "backgrounds") {
      setTab("home");
    }
  }, [canManageBackgrounds, tab]);

  useEffect(() => {
    if (!canOpenChats && tab === "chats") {
      setTab("home");
    }
  }, [canOpenChats, tab]);

  useEffect(() => {
    const db = getFirebaseDb();

    if (!configured || !db) {
      setUsers([
        { id: emailToKey(SUPER_ADMIN_EMAIL), email: SUPER_ADMIN_EMAIL, role: "superadmin", banned: false, status: "online", lastSeen: t.connectedNow }
      ]);
      return;
    }

    const unsub = onSnapshot(collection(db, "access_list"), (snapshot) => {
      const list: UserRow[] = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          email: (data.email as string) || "unknown@email.com",
          role: ((data.role as UserRole) || "viewer") as UserRole,
          banned: Boolean(data.banned),
          deleted: Boolean(data.deleted),
          status: (data.status === "online" ? "online" : "offline") as "online" | "offline",
          lastSeen: (data.lastSeenText as string) || t.active
        };
      });

      if (myEmail && canEditRoles && !list.some((u) => u.email.toLowerCase() === myEmail)) {
        list.unshift({
          id: emailToKey(myEmail),
          email: myEmail,
          role: (role ?? "superadmin") as UserRole,
          banned: false,
          deleted: false,
          status: "online",
          lastSeen: t.connectedNow
        });
      }

      if (!list.some((u) => u.email.toLowerCase() === SUPER_ADMIN_EMAIL)) {
        list.unshift({ id: emailToKey(SUPER_ADMIN_EMAIL), email: SUPER_ADMIN_EMAIL, role: "superadmin", banned: false, deleted: false, status: "online", lastSeen: t.connectedNow });
      }

      setUsers(list.sort((a, b) => {
        const aEmail = a.email.toLowerCase();
        const bEmail = b.email.toLowerCase();
        if (aEmail === myEmail && bEmail !== myEmail) return -1;
        if (aEmail !== myEmail && bEmail === myEmail) return 1;
        if (aEmail === ownerEmail && bEmail !== ownerEmail) return -1;
        if (aEmail !== ownerEmail && bEmail === ownerEmail) return 1;
        if (a.status !== b.status) return a.status === "online" ? -1 : 1;
        return a.email.localeCompare(b.email);
      }));
    }, (err) => {
      console.warn("[HomeDashboard] access_list listener error:", err.message);
    });

    return () => unsub();
  }, [canEditRoles, configured, myEmail, ownerEmail, role, t.active, t.connectedNow]);

  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_IMAGE_STORAGE_KEY);
    if (!saved) return;
    setProfileImage(saved);
    setPhotoError(false);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as unknown as { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> });
    };
    const installedHandler = () => setAppInstalled(true);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    if (window.matchMedia("(display-mode: standalone)").matches) setAppInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setAppInstalled(true);
    setInstallPrompt(null);
  };

  useEffect(() => {
    const raw = localStorage.getItem(PROJECT_IMAGE_STORAGE_KEY);
    if (!raw) return;
    try {
      setProjectImages((prev) => ({ ...prev, ...(JSON.parse(raw) as Record<ProjectId, string>) }));
    } catch {
      // ignore invalid cache
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(PROJECT_IMAGE_SECONDARY_STORAGE_KEY);
    if (!raw) return;
    try {
      setProjectSecondaryImages((prev) => ({ ...prev, ...(JSON.parse(raw) as Partial<Record<ProjectId, string>>) }));
    } catch {
      // ignore invalid cache
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(PROJECT_IMAGE_STYLE_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as typeof defaultProjectImageStyles;
      const normalized = {
        1: { ...parsed[1], fit: "contain" as const, scale: Math.max(0.3, Math.min(1.4, parsed[1]?.scale ?? 1)) },
        2: { ...parsed[2], fit: "contain" as const, scale: Math.max(0.3, Math.min(1.4, parsed[2]?.scale ?? 1)) },
        3: { ...parsed[3], fit: "contain" as const, scale: Math.max(0.3, Math.min(1.4, parsed[3]?.scale ?? 1)) },
        4: { ...parsed[4], fit: "contain" as const, scale: Math.max(0.3, Math.min(1.4, parsed[4]?.scale ?? 1)) }
      };
      setProjectImageStyles((prev) => ({ ...prev, ...normalized }));
    } catch {
      // ignore invalid cache
    }
  }, []);

  const translatedRole = (value: UserRole) => {
    if (value === "superadmin") return t.roleSuper;
    if (value === "admin") return t.roleAdmin;
    return t.roleViewer;
  };
  const chatCandidates = useMemo(() => {
    const byEmail = new Map(users.map((row) => [row.email.toLowerCase(), row]));
    const candidateEmails = new Set(chatThreadEmails.map((email) => email.toLowerCase()));

    for (const row of users) {
      if (row.email.toLowerCase() !== myEmail && !row.deleted) {
        candidateEmails.add(row.email.toLowerCase());
      }
    }

    const resolved = Array.from(candidateEmails)
      .filter((email) => email !== myEmail)
      .map((email) => byEmail.get(email))
      .filter((row): row is UserRow => Boolean(row) && !(row as UserRow).deleted);

    if (myEmail && myEmail !== ownerEmail && !resolved.some((row) => row.email.toLowerCase() === ownerEmail)) {
      resolved.unshift({
        id: emailToKey(ownerEmail),
        email: ownerEmail,
        role: "superadmin",
        banned: false,
        status: "offline",
        lastSeen: t.active
      });
    }

    return resolved.sort((a, b) => {
      const aEmail = a.email.toLowerCase();
      const bEmail = b.email.toLowerCase();
      const aOwner = aEmail === ownerEmail;
      const bOwner = bEmail === ownerEmail;
      if (aOwner && !bOwner) return -1;
      if (!aOwner && bOwner) return 1;

      const aRecent = chatThreadEmails.includes(aEmail);
      const bRecent = chatThreadEmails.includes(bEmail);
      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;

      if (a.status !== b.status) return a.status === "online" ? -1 : 1;
      return a.email.localeCompare(b.email);
    });
  }, [chatThreadEmails, myEmail, ownerEmail, t.active, users]);

  const selectedChatUser = useMemo(() => chatCandidates.find((row) => row.email === selectedChatEmail), [chatCandidates, selectedChatEmail]);

  // Filtered chat candidates based on search
  const filteredChatCandidates = useMemo(() => {
    if (!chatSearch.trim()) return chatCandidates;
    const q = chatSearch.trim().toLowerCase();
    return chatCandidates.filter((row) => row.email.toLowerCase().includes(q));
  }, [chatCandidates, chatSearch]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Avatar initials helper and color
  const getAvatarInitials = (email: string) => {
    const name = email.split("@")[0];
    const parts = name.split(/[._-]/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (email: string) => {
    const colors = ["#2563eb", "#7c3aed", "#059669", "#dc2626", "#d97706", "#0891b2", "#be185d", "#4f46e5"];
    let hash = 0;
    for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // Track last messages per user for sidebar preview
  useEffect(() => {
    if (!selectedChatEmail || chatMessages.length === 0) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg) {
      setLastMessages((prev) => ({
        ...prev,
        [selectedChatEmail.toLowerCase()]: lastMsg.text.length > 40 ? lastMsg.text.substring(0, 40) + "..." : lastMsg.text
      }));
    }
  }, [chatMessages, selectedChatEmail]);

  useEffect(() => {
    if (chatCandidates.length === 0) {
      if (selectedChatEmail) setSelectedChatEmail("");
      return;
    }
    const exists = chatCandidates.some((row) => row.email === selectedChatEmail);
    if (!exists) {
      setSelectedChatEmail(chatCandidates[0].email);
    }
  }, [chatCandidates, selectedChatEmail]);

  useEffect(() => {
    if (!configured || !myEmail) {
      setChatThreadEmails([]);
      return;
    }
    const db = getFirebaseDb();
    if (!db) return;
    const threadsQuery = query(collection(db, "chat_threads"), where("participants", "array-contains", myEmail));
    const unsub = onSnapshot(threadsQuery, (snapshot) => {
      const next = new Set<string>();
      snapshot.docs.forEach((item) => {
        const data = item.data() as { participants?: string[] };
        const other = (data.participants || []).find((email) => email.toLowerCase() !== myEmail);
        if (other) next.add(other.toLowerCase());
      });
      setChatThreadEmails(Array.from(next));
    }, (err) => {
      console.warn("[HomeDashboard] chat_threads listener error:", err.message);
    });
    return () => unsub();
  }, [configured, myEmail]);

  const getThreadId = (emailA: string, emailB: string) =>
    [emailToKey(emailA), emailToKey(emailB)].sort((a, b) => a.localeCompare(b)).join("__");

  const formatChatDate = (value: Timestamp | null) => {
    if (!value) return "";
    const date = value.toDate();
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : lang === "fr" ? "fr-FR" : "en-US", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  };

  useEffect(() => {
    if (!configured || !myEmail || !selectedChatEmail) {
      setChatMessages([]);
      setChatBlockedByMe(false);
      setChatBlockedMe(false);
      setChatError("");
      return;
    }
    const db = getFirebaseDb();
    if (!db) return;

    const threadId = getThreadId(myEmail, selectedChatEmail);
    const threadRef = doc(db, "chat_threads", threadId);
    const messagesQuery = query(collection(db, "chat_threads", threadId, "messages"), orderBy("createdAt", "asc"));

    const unsubThread = onSnapshot(threadRef, (snapshot) => {
      const data = snapshot.data() as { blockedBy?: Record<string, boolean> } | undefined;
      const blockedBy = data?.blockedBy || {};
      setChatBlockedByMe(Boolean(blockedBy[emailToKey(myEmail)]));
      setChatBlockedMe(Boolean(blockedBy[emailToKey(selectedChatEmail)]));
    }, (err) => {
      console.warn("[HomeDashboard] threadRef listener error:", err.message);
    });

    const unsub = onSnapshot(messagesQuery, (snapshot) => {
      const list = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          text: (data.text as string) || "",
          senderEmail: (data.senderEmail as string) || "",
          receiverEmail: (data.receiverEmail as string) || "",
          systemOnlyFor: (data.systemOnlyFor as string | undefined) || null,
          createdAt: (data.createdAt as Timestamp | undefined) || null
        } satisfies ChatMessage;
      });
      setChatMessages(list);
    }, (err) => {
      console.warn("[HomeDashboard] messages listener error:", err.message);
    });

    return () => {
      unsub();
      unsubThread();
    };
  }, [configured, myEmail, selectedChatEmail]);

  const toggleRole = async (row: UserRow) => {
    if (!canEditRoles || row.role === "superadmin") return;
    const nextRole: UserRole = row.role === "viewer" ? "admin" : "viewer";

    setUsers((prev) => prev.map((u) => (u.id === row.id ? { ...u, role: nextRole } : u)));

    const db = getFirebaseDb();
    if (configured && db) {
      await updateDoc(doc(db, "access_list", row.id), { role: nextRole, updatedAt: serverTimestamp() });
    }
  };

  const removeUser = async (row: UserRow) => {
    if (!canDeleteUsers || row.role === "superadmin") return;
    setUsers((prev) => prev.filter((u) => u.id !== row.id));

    const db = getFirebaseDb();
    if (configured && db) {
      // Soft-delete: mark as deleted + banned so the user is kicked out and cannot re-login
      await updateDoc(doc(db, "access_list", row.id), {
        deleted: true,
        banned: true,
        status: "offline",
        lastSeenText: "Deleted by admin",
        updatedAt: serverTimestamp()
      });
    }
  };

  const toggleBan = async (row: UserRow) => {
    if (!canEditRoles || row.role === "superadmin") return;
    const nextBanned = !row.banned;
    const nextStatus = nextBanned ? "offline" : row.status;
    const nextLastSeen = nextBanned ? "Banned by admin" : row.lastSeen;

    setUsers((prev) =>
      prev.map((u) => (u.id === row.id ? { ...u, banned: nextBanned, status: nextStatus, lastSeen: nextLastSeen } : u))
    );

    const db = getFirebaseDb();
    if (configured && db) {
      await updateDoc(doc(db, "access_list", row.id), {
        banned: nextBanned,
        status: nextStatus,
        lastSeenText: nextLastSeen,
        updatedAt: serverTimestamp()
      });
    }
  };

  const addUser = async () => {
    if (!canAddUsers || !inviteEmail.trim()) return;
    const email = inviteEmail.trim().toLowerCase();
    const key = emailToKey(email);
    const nextRow: UserRow = {
      id: key,
      email,
      role: inviteRole,
      banned: false,
      status: "offline",
      lastSeen: "Pending first login"
    };

    setUsers((prev) => {
      const filtered = prev.filter((row) => row.email.toLowerCase() !== email);
      return [nextRow, ...filtered];
    });

    const db = getFirebaseDb();
    if (configured && db) {
      await setDoc(
        doc(db, "access_list", key),
        {
          email,
          role: inviteRole,
          banned: false,
          status: "offline",
          lastSeenText: "Pending first login",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      await setDoc(
        doc(db, "users", key),
        {
          uid: key,
          email,
          role: inviteRole,
          banned: false,
          status: "offline",
          lastSeenText: "Pending first login",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }

    setInviteEmail("");
    setInviteRole("viewer");
    setNotice(t.added);
    setTimeout(() => setNotice(""), 2000);
  };

  const sendChatMessage = async () => {
    if (!configured || !myEmail || !selectedChatEmail || selectedChatEmail === myEmail || !chatText.trim() || chatBlockedByMe || chatBlockedMe) return;
    const db = getFirebaseDb();
    if (!db) return;
    try {
      const threadId = getThreadId(myEmail, selectedChatEmail);
      await setDoc(
        doc(db, "chat_threads", threadId),
        { participants: [myEmail, selectedChatEmail], updatedAt: serverTimestamp() },
        { merge: true }
      );
      await addDoc(collection(db, "chat_threads", threadId, "messages"), {
        text: chatText.trim(),
        senderEmail: myEmail,
        receiverEmail: selectedChatEmail,
        createdAt: serverTimestamp()
      });
      setChatText("");
      setChatError("");
    } catch (error) {
      console.error("[HomeDashboard] sendChatMessage failed", error);
      setChatError("تعذر إرسال الرسالة. تحقق من اختيار المستخدم ومن صلاحيات Firestore.");
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!configured || !myEmail || !selectedChatEmail) return;
    const db = getFirebaseDb();
    if (!db) return;
    const threadId = getThreadId(myEmail, selectedChatEmail);
    await deleteDoc(doc(db, "chat_threads", threadId, "messages", messageId));
  };

  const toggleChatBlockFor = async (otherEmail: string) => {
    if (!configured || !myEmail || !otherEmail || otherEmail.toLowerCase() === ownerEmail) return;
    const db = getFirebaseDb();
    if (!db) return;
    const threadId = getThreadId(myEmail, otherEmail);
    const myKey = emailToKey(myEmail);
    const blockedNow = selectedChatEmail === otherEmail ? chatBlockedByMe : false;
    await setDoc(
      doc(db, "chat_threads", threadId),
      {
        participants: [myEmail, otherEmail],
        blockedBy: { [myKey]: !blockedNow },
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  };

  const deleteThreadFor = async (otherEmail: string) => {
    if (!configured || !myEmail || !otherEmail || otherEmail.toLowerCase() === ownerEmail) return;
    const db = getFirebaseDb();
    if (!db) return;
    const threadId = getThreadId(myEmail, otherEmail);
    const messagesRef = collection(db, "chat_threads", threadId, "messages");
    const snapshot = await getDocs(messagesRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    batch.delete(doc(db, "chat_threads", threadId));
    await batch.commit();
    if (selectedChatEmail === otherEmail) {
      setSelectedChatEmail("");
      setChatMessages([]);
    }
  };

  const cards = useMemo(
    () =>
      [0, 1, 2, 3].map((i) => ({
        label: t.projectLabel[i],
        title: t.projectTitle[i],
        desc: t.projectDesc[i],
        image: projectImages[(i + 1) as ProjectId]
      })),
    [projectImages, t.projectDesc, t.projectLabel, t.projectTitle]
  );

  const router = useRouter();

  const onLogout = async () => {
    await signOutUser();
    router.replace("/");
  };

  const onCustomBackground = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      const nextPreset: BgPreset = {
        id: `custom-${Date.now()}`,
        label: "Uploaded",
        value: `url(${result}) center / cover no-repeat`
      };
      setBgPresets((prev) => [nextPreset, ...prev]);
      setSelectedPresetId(nextPreset.id);
    };
    reader.readAsDataURL(file);
  };

  const applyBackgroundToProject = () => {
    const preset = bgPresets.find((item) => item.id === selectedPresetId);
    if (!preset) return;

    let existing: Record<BgProject, string> = { ...defaultProjectBackgrounds };

    const raw = localStorage.getItem(PROJECT_BG_STORAGE_KEY);
    if (raw) {
      try {
        existing = { ...existing, ...(JSON.parse(raw) as Record<BgProject, string>) };
      } catch {
        // ignore invalid local cache
      }
    }

    const next = { ...existing, [selectedProject]: preset.value };
    localStorage.setItem(PROJECT_BG_STORAGE_KEY, JSON.stringify(next));
    setBgNotice(`تم تطبيق الخلفية على المشروع ${selectedProject}`);
    setTimeout(() => setBgNotice(""), 2200);
  };

  const applyProjectImageFor = (projectId: ProjectId, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      setDraftImage(result);
      setDraftProject(projectId);
      setDraftStyle({ ...projectImageStyles[projectId], fit: "contain", scale: 1 });
      setBgNotice(`تم تحميل الصورة للمشروع ${projectId}. عدل المقاس ثم اضغط اعتماد الصورة.`);
      setTimeout(() => setBgNotice(""), 2600);
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const applySecondaryProjectImageFor = (projectId: ProjectId, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      const next = { ...projectSecondaryImages, [projectId]: result };
      setProjectSecondaryImages(next);
      localStorage.setItem(PROJECT_IMAGE_SECONDARY_STORAGE_KEY, JSON.stringify(next));
      setBgNotice(`تم إضافة صورة ثانية للمشروع ${projectId}`);
      setTimeout(() => setBgNotice(""), 2200);
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  };



  const applyDraftImage = () => {
    if (!draftImage || !draftProject) return;
    const nextImages = { ...projectImages, [draftProject]: draftImage };
    const nextStyles = { ...projectImageStyles, [draftProject]: draftStyle };
    setProjectImages(nextImages);
    setProjectImageStyles(nextStyles);
    localStorage.setItem(PROJECT_IMAGE_STORAGE_KEY, JSON.stringify(nextImages));
    localStorage.setItem(PROJECT_IMAGE_STYLE_STORAGE_KEY, JSON.stringify(nextStyles));
    setBgNotice(`تم اعتماد صورة المشروع ${draftProject}`);
    setTimeout(() => setBgNotice(""), 2200);
    setDraftImage(null);
    setDraftProject(null);
  };

  const cancelDraftImage = () => {
    setDraftImage(null);
    setDraftProject(null);
  };

  const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
  const clampZoom = (value: number) => Math.max(0.3, Math.min(1.4, value));

  const onDraftMouseDown = (event: React.MouseEvent<HTMLImageElement>) => {
    dragStateRef.current = { dragging: true, x: event.clientX, y: event.clientY };
  };

  const onDraftMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.dragging) return;
    const frame = draftFrameRef.current;
    if (!frame) return;

    const dx = event.clientX - dragStateRef.current.x;
    const dy = event.clientY - dragStateRef.current.y;
    dragStateRef.current = { dragging: true, x: event.clientX, y: event.clientY };

    const xDelta = (dx / Math.max(1, frame.clientWidth)) * 100;
    const yDelta = (dy / Math.max(1, frame.clientHeight)) * 100;

    setDraftStyle((prev) => ({
      ...prev,
      x: clampPercent(prev.x + xDelta),
      y: clampPercent(prev.y + yDelta)
    }));
  };

  const onDraftMouseUp = () => {
    dragStateRef.current.dragging = false;
  };

  const onDraftWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    setDraftStyle((prev) => ({ ...prev, scale: clampZoom(prev.scale + delta) }));
  };

  const getLiveImageForProject = (projectId: ProjectId) => {
    if (draftProject === projectId && draftImage) return draftImage;
    return projectImages[projectId];
  };
  const getSecondaryImageForProject = (projectId: ProjectId) => projectSecondaryImages[projectId] || null;
  const getLiveStyleForProject = (projectId: ProjectId) => {
    if (draftProject === projectId && draftImage) return draftStyle;
    return projectImageStyles[projectId];
  };

  const handleProjectImageClick = (projectId: ProjectId, event: MouseEvent<HTMLImageElement>, title: string) => {
    event.preventDefault();
    event.stopPropagation();

    const existingTimer = projectClickTimers.current[projectId];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      delete projectClickTimers.current[projectId];
      if (canManageBackgrounds) {
        quickProjectInputRefs.current[projectId]?.click();
      }
      return;
    }

    projectClickTimers.current[projectId] = window.setTimeout(() => {
      delete projectClickTimers.current[projectId];
      setProjectPreview({
        src: getLiveImageForProject(projectId),
        alt: title
      });
    }, 180);
  };

  const closeProjectPreview = () => setProjectPreview(null);

  const updateImageStyle = (projectId: ProjectId, patch: Partial<(typeof defaultProjectImageStyles)[1]>) => {
    const next = { ...projectImageStyles, [projectId]: { ...projectImageStyles[projectId], ...patch, fit: "contain" } };
    setProjectImageStyles(next);
    localStorage.setItem(PROJECT_IMAGE_STYLE_STORAGE_KEY, JSON.stringify(next));
  };

  const onProfileImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      setProfileImage(result);
      setPhotoError(false);
      localStorage.setItem(PROFILE_IMAGE_STORAGE_KEY, result);
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className={styles.page}>
      <header className={styles.navbar}>
        <div className={styles.brandWrap}>
          <button
            type="button"
            className={styles.profilePreviewBtn}
            onClick={() => setPreviewOpen(true)}
          >
            <div className={styles.profileBox}>
              {!photoError ? (
                <img src={profileImage} alt="profile" className={styles.profileImg} onError={() => setPhotoError(true)} />
              ) : (
                <div className={styles.profileFallback}>JO</div>
              )}
            </div>
          </button>
          <input ref={profileInputRef} type="file" accept="image/*" className={styles.hiddenFileInput} onChange={onProfileImageChange} />
          <div>
            <EditableText id={`home-brand-${lang}`} defaultText={t.brand} as="h1" className={styles.mainTitle} editable={canEditText} />
            <EditableText id={`home-subtitle-${lang}`} defaultText={t.subtitle} as="p" className={styles.mainSub} editable={canEditText} />
          </div>
        </div>

        <div className={styles.navActions}>
          {canOpenUsers && (
            <button className={`${styles.navBtn} ${tab === "users" ? styles.active : ""}`} onClick={() => setTab("users")}>
              {t.users}
            </button>
          )}
          {canOpenChats && (
            <button className={`${styles.navBtn} ${tab === "chats" ? styles.active : ""}`} onClick={() => setTab("chats")}>
              {t.chats}
            </button>
          )}
          {canManageBackgrounds && (
            <button className={`${styles.navBtn} ${tab === "backgrounds" ? styles.active : ""}`} onClick={() => setTab("backgrounds")}>
              {t.backgrounds}
            </button>
          )}
          {canOpenUsers && (
            <Link href="/admin/licenses" className={styles.navBtn}>
              {t.licenses}
            </Link>
          )}
          <button className={`${styles.navBtn} ${tab === "home" ? styles.active : ""}`} onClick={() => setTab("home")}>
            {t.home}
          </button>
          {installPrompt && !appInstalled && (
            <button className={styles.installBtn} onClick={handleInstallApp}>
              {lang === "ar" ? "تحميل التطبيق" : lang === "fr" ? "Installer l'app" : "Install App"}
            </button>
          )}
          <button className={styles.logout} onClick={onLogout}>
            {t.logout}
          </button>
        </div>
      </header>

      {tab === "home" && (
        <div className={styles.screen}>
          <EditableText id={`home-auth-note-${lang}`} defaultText={t.authOnly} as="p" className={styles.lockNote} editable={canEditText} />

          <div className={styles.grid}>
            {cards.map((card, index) => {
              const content = (
                <article className={`${styles.card} ${index > 0 ? styles.coming : ""}`} style={{ "--delay": `${index * 80}ms` } as CSSProperties}>
                  <div className={styles.cardImageWrap}>
                    <img
                      src={getLiveImageForProject((index + 1) as ProjectId)}
                      alt={card.title}
                      className={styles.cardImage}
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div className={styles.cardBody}>
                    <EditableText id={`card-label-${lang}-${index}`} defaultText={card.label} as="div" className={styles.cardNum} editable={canEditText} />
                    <EditableText id={`card-title-${lang}-${index}`} defaultText={card.title} as="div" className={styles.cardTitle} editable={canEditText} />
                    <EditableText id={`card-desc-${lang}-${index}`} defaultText={card.desc} as="div" className={styles.cardDesc} editable={canEditText} />
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.cardStatus}>
                      <span className={`${styles.cardStatusDot} ${index === 0 ? "" : styles.cardStatusDotOffline}`} />
                      {index === 0 ? (lang === "ar" ? "متصل" : "Live") : (lang === "ar" ? "قريبا" : "Soon")}
                    </span>
                    <span>{lang === "ar" ? `المشروع ${index + 1}` : `Project ${index + 1}`}</span>
                  </div>
                </article>
              );

              return (
                <Link key={card.label} href={projectLinks[index]} className={styles.cardLink}>
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {tab === "home" && (
        <div className={styles.mapCardSection}>
          <Link href="/map" className={styles.mapCardLink}>
            <span className={styles.mapCardIcon}>{"\uD83D\uDDFA\uFE0F"}</span>
            <div className={styles.mapCardText}>
              <span className={styles.mapCardTitle}>
                {lang === "ar" ? "\u062E\u0631\u064A\u0637\u0629 \u0627\u0644\u0645\u062D\u0637\u0629" : lang === "fr" ? "Carte de la station" : "Station Map"}
              </span>
              <span className={styles.mapCardDesc}>
                {lang === "ar" ? "\u0639\u0631\u0636 \u0645\u0648\u0642\u0639 \u0627\u0644\u0645\u062D\u0637\u0629 \u0639\u0644\u0649 \u0627\u0644\u062E\u0631\u064A\u0637\u0629" : "View station location on map"}
              </span>
            </div>
            <span className={styles.mapCardArrow}>&rarr;</span>
          </Link>
        </div>
      )}

      {tab === "users" && canOpenUsers && (
        <div className={styles.screen}>
          <div className={styles.usersHeader}>
            <h2>{canEditRoles ? t.usersTitle : "حسابي"}</h2>
            <button className={styles.backBtn} onClick={() => setTab("home")}>
              {t.back}
            </button>
          </div>

          {canAddUsers && (
            <div className={styles.addUserCard}>
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className={styles.addInput}
                type="email"
                placeholder={t.email}
              />

              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)} className={styles.addSelect}>
                <option value="viewer">{t.roleViewer}</option>
                <option value="admin">{t.roleAdmin}</option>
              </select>

              <button className={styles.addBtn} onClick={addUser}>
                {t.addUser}
              </button>
            </div>
          )}

          {notice && <p className={styles.notice}>{notice}</p>}
          {!canEditRoles && <p className={styles.permissionHint}>هذا القسم يعرض حسابك فقط. المستخدمون الآخرون يظهرون للـ super admin.</p>}

          {visibleUsers.map((row, index) => (
            <article key={row.id} className={styles.userRow} style={{ "--delay": `${index * 55}ms` } as CSSProperties}>
              <div className={styles.userLeft}>
                <span className={row.status === "online" ? styles.dotOnline : styles.dotOffline} />
                <div>
                  <div className={styles.userEmail}>{row.email}</div>
                  <div className={styles.userTime}>{row.banned ? t.banned : row.lastSeen}</div>
                </div>
              </div>

              <div className={styles.userActions}>
                <button
                  disabled={!canEditRoles || row.role === "superadmin"}
                  className={`${styles.roleBtn} ${styles[row.role]}`}
                  onClick={() => toggleRole(row)}
                >
                  {translatedRole(row.role)}
                </button>
                {row.role !== "superadmin" && (
                  <button disabled={!canEditRoles} className={styles.banBtn} onClick={() => toggleBan(row)}>
                    {row.banned ? t.unban : t.ban}
                  </button>
                )}
                {row.role !== "superadmin" && (
                  <button disabled={!canDeleteUsers} className={styles.delBtn} onClick={() => removeUser(row)}>
                    {t.delete}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === "backgrounds" && canManageBackgrounds && (
        <div className={styles.screen}>
          <div className={styles.usersHeader}>
            <h2>{t.backgroundsTitle}</h2>
            <button className={styles.backBtn} onClick={() => setTab("home")}>
              {t.back}
            </button>
          </div>

          <article className={styles.backgroundManager}>
            {/* Left Sidebar */}
            <div className={styles.bgSidebar}>
              <h3 className={styles.bgSidebarTitle}>{lang === "ar" ? "اختر خلفية" : lang === "fr" ? "Choisir un fond" : "Choose background"}</h3>
              <label className={styles.bgUploadArea}>
                <div className={styles.bgUploadIcon}>📁</div>
                <div className={styles.bgUploadText}>{lang === "ar" ? "رفع صورة من الجهاز" : "Upload from device"}</div>
                <div className={styles.bgUploadHint}>PNG, JPG, WebP</div>
                <input type="file" accept="image/*" onChange={onCustomBackground} />
              </label>
              <div className={styles.bgPresetSection}>
                <div className={styles.bgSidebarTitle}>{lang === "ar" ? "خلفيات جاهزة" : "Presets"}</div>
                <div className={styles.bgPresetGrid}>
                {bgPresets.map((preset) => (
                  <button key={preset.id} type="button" className={`${styles.bgPresetItem} ${selectedPresetId === preset.id ? styles.bgPresetSelected : ""}`} style={{ background: preset.value }} onClick={() => setSelectedPresetId(preset.id)} aria-label={preset.label}>
                    {selectedPresetId === preset.id && <span className={styles.bgPresetCheck}>✓</span>}
                    <span className={styles.bgPresetLabel}>{preset.label}</span>
                  </button>
                ))}
                </div>
              </div>
            </div>
            {/* Right Main Area */}
            <div className={styles.bgMainArea}>
              <div className={styles.bgPreviewCard}>
                <div className={styles.bgPreviewInner} style={{ background: bgPresets.find((p) => p.id === selectedPresetId)?.value || defaultBgPresets[0].value, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
                  <div className={styles.bgPreviewOverlay}><h3>{t.projectTitle[selectedProject - 1]}</h3><p>{t.projectDesc[selectedProject - 1]}</p></div>
                </div>
              </div>
              <div className={styles.bgProjectSection}>
                <div className={styles.bgProjectLabel}>{lang === "ar" ? "اختر المشروع" : "Select project"}</div>
                <div className={styles.bgProjectGrid}>
                  {([1,2,3,4] as const).map((project) => (
                    <button key={project} type="button" className={`${styles.bgProjectBtn} ${selectedProject === project ? styles.bgProjectBtnActive : ""}`} onClick={() => setSelectedProject(project)}>
                      {lang === "ar" ? t.projectTitle[project - 1] : `Project ${project}`}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.bgActions}>
                <button className={styles.bgApplyBtn} onClick={applyBackgroundToProject}>
                  {lang === "ar" ? `تطبيق على ${t.projectTitle[selectedProject - 1]}` : `Apply to ${t.projectTitle[selectedProject - 1]}`}
                </button>
                <button className={styles.bgResetBtn} onClick={() => {
                  let existing: Record<number, string> = { ...defaultProjectBackgrounds };
                  const raw = localStorage.getItem(PROJECT_BG_STORAGE_KEY);
                  if (raw) { try { existing = { ...existing, ...(JSON.parse(raw) as Record<number, string>) }; } catch {} }
                  const next = { ...existing }; delete next[selectedProject];
                  localStorage.setItem(PROJECT_BG_STORAGE_KEY, JSON.stringify(next));
                  setBgNotice(lang === "ar" ? "تم إعادة الخلفية للوضع الافتراضي" : "Background reset");
                  setTimeout(() => setBgNotice(""), 2200);
                }}>{lang === "ar" ? "إعادة تعيين" : "Reset"}</button>
              </div>
              {bgNotice && <p className={styles.bgNotice}>{bgNotice}</p>}
            </div>
          </article>
          {/* Project Images */}
          <div className={styles.backgroundManager} style={{ marginTop: "0.8rem", gridTemplateColumns: "1fr" }}>
            <div style={{ padding: "1rem" }}>
              <h3 className={styles.bgSidebarTitle}>{lang === "ar" ? "إدارة صور المشاريع" : "Project Images"}</h3>
              <div className={styles.bgProjectGrid} style={{ marginTop: "0.5rem" }}>
                {([1,2,3,4] as const).map((project) => (
                  <button key={project} type="button" className={`${styles.bgProjectBtn} ${selectedProject === project ? styles.bgProjectBtnActive : ""}`} onClick={() => setSelectedProject(project)}>{t.projectTitle[project - 1]}</button>
                ))}
              </div>
              <div className={styles.multiImageUploads} style={{ marginTop: "0.6rem" }}>
                <div key={selectedProject} className={styles.imageControlCard}>
                  <label className={styles.imageUploadBox}>
                    <span>{lang === "ar" ? `تغيير صورة ${t.projectTitle[selectedProject - 1]}` : "Change image"}</span>
                    <input ref={(el) => { fileInputRefs.current[selectedProject] = el; }} type="file" accept="image/*" onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }} onChange={(e) => applyProjectImageFor(selectedProject as ProjectId, e)} />
                  </label>
                  <label className={styles.imageUploadBox}>
                    <span>{lang === "ar" ? "صورة ثانية لملء الفراغ" : "Secondary image"}</span>
                    <input type="file" accept="image/*" onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }} onChange={(e) => applySecondaryProjectImageFor(selectedProject as ProjectId, e)} />
                  </label>

                  <div className={styles.manualHint}>{lang === "ar" ? "حرك الصورة بالماوس وكبّر/صغّر بعجلة الماوس" : "Drag to move, scroll to zoom"}</div>
                  <div className={styles.imagePreviewWrap}>
                    <div className={styles.imagePreviewLabel}>{lang === "ar" ? `معاينة ${t.projectTitle[selectedProject - 1]}` : "Preview"}</div>
                    <div className={styles.imagePreviewFrame}>
                      <img src={getLiveImageForProject(selectedProject as ProjectId)} alt={`project-${selectedProject}`} className={styles.imagePreview} style={{ objectFit: "cover" }} />
                    </div>
                  </div>
                </div>
              </div>
              {draftImage && draftProject && (
                <div className={styles.draftEditor}>
                  <h3>{lang === "ar" ? `ضبط الصورة - ${t.projectTitle[draftProject - 1]}` : `Adjust - ${t.projectTitle[draftProject - 1]}`}</h3>
                  <div ref={draftFrameRef} className={styles.draftPreviewFrame} onMouseMove={onDraftMouseMove} onMouseUp={onDraftMouseUp} onMouseLeave={onDraftMouseUp} onWheel={onDraftWheel}>
                    <img src={draftImage} alt="draft" className={styles.draftPreview} onMouseDown={onDraftMouseDown} style={{ objectFit: draftStyle.fit, objectPosition: `${draftStyle.x}% ${draftStyle.y}%`, transform: `scale(${draftStyle.scale})`, transformOrigin: "center center" }} />
                  </div>
                  <div className={styles.draftActions}>
                    <button type="button" className={styles.zoomBtn} onClick={() => setDraftStyle((p) => ({ ...p, scale: clampZoom(p.scale - 0.1) }))}>−</button>
                    <button type="button" className={styles.zoomBtn} onClick={() => setDraftStyle((p) => ({ ...p, scale: clampZoom(p.scale + 0.1) }))}>+</button>
                    <button type="button" className={styles.bgApplyBtn} onClick={applyDraftImage}>{lang === "ar" ? "اعتماد" : "Apply"}</button>
                    <button type="button" className={styles.cancelDraftBtn} onClick={cancelDraftImage}>{lang === "ar" ? "إلغاء" : "Cancel"}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {tab === "chats" && canOpenChats && (
        <div className={styles.screen}>
          <div className={styles.usersHeader}>
            <h2>{t.chatsTitle}</h2>
            <button className={styles.backBtn} onClick={() => setTab("home")}>
              {t.back}
            </button>
          </div>

          <div className={styles.chatLayout}>
            {/* ── Sidebar: Users List (LEFT) ── */}
            <aside className={styles.chatUsersList}>
              <div className={styles.chatSearchWrap}>
                <input
                  type="text"
                  className={styles.chatSearchInput}
                  placeholder={lang === "ar" ? "ابحث عن مستخدم..." : lang === "fr" ? "Rechercher un utilisateur..." : "Search user..."}
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                />
              </div>
              <div className={styles.chatUserListScroll}>
                {filteredChatCandidates.length === 0 ? (
                  <div className={styles.chatEmpty}>{t.chatsNoUsers}</div>
                ) : (
                  filteredChatCandidates.map((chatUser) => (
                    <div
                      key={chatUser.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedChatEmail(chatUser.email)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedChatEmail(chatUser.email);
                        }
                      }}
                      className={`${styles.chatUserItem} ${selectedChatEmail === chatUser.email ? styles.chatUserItemActive : ""}`}
                    >
                      <div
                        className={`${styles.chatAvatar} ${chatUser.status === "online" ? styles.chatAvatarOnline : ""}`}
                        style={{ background: getAvatarColor(chatUser.email) }}
                      >
                        {getAvatarInitials(chatUser.email)}
                      </div>
                      <div className={styles.chatUserMeta}>
                        <span className={styles.chatUserEmail}>
                          {chatUser.email === myEmail ? `${chatUser.email} (you)` : chatUser.email}
                        </span>
                        {lastMessages[chatUser.email.toLowerCase()] && (
                          <span className={styles.chatUserLastMsg}>{lastMessages[chatUser.email.toLowerCase()]}</span>
                        )}
                      </div>
                      <span className={styles.chatUserActions}>
                        {chatUser.email.toLowerCase() !== ownerEmail && (
                          <>
                            <button
                              type="button"
                              className={styles.chatRowAction}
                              onClick={(e) => {
                                e.stopPropagation();
                                void toggleChatBlockFor(chatUser.email);
                              }}
                              title={selectedChatEmail === chatUser.email && chatBlockedByMe ? t.chatsUnblock : t.chatsBlock}
                            >
                              {selectedChatEmail === chatUser.email && chatBlockedByMe ? "↩" : "⊘"}
                            </button>
                            <button
                              type="button"
                              className={styles.chatRowActionDelete}
                              onClick={(e) => {
                                e.stopPropagation();
                                void deleteThreadFor(chatUser.email);
                              }}
                              title={t.delete}
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </aside>

            {/* ── Chat Panel (RIGHT) ── */}
            <section className={styles.chatPanel}>
              {chatCandidates.length === 0 ? (
                <div className={styles.chatEmpty}>{t.chatsNoUsers}</div>
              ) : !selectedChatUser ? (
                <div className={styles.chatEmpty}>
                  <div>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>💬</div>
                    <div>{t.chatsSelectUser}</div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Top bar with user info */}
                  <div className={styles.chatTopBar}>
                    <div className={styles.chatTopBarInfo}>
                      <div
                        className={`${styles.chatAvatar} ${selectedChatUser.status === "online" ? styles.chatAvatarOnline : ""}`}
                        style={{ background: getAvatarColor(selectedChatUser.email), width: 36, height: 36, fontSize: "0.8rem" }}
                      >
                        {getAvatarInitials(selectedChatUser.email)}
                      </div>
                      <div>
                        <div className={styles.chatTopBarName}>{selectedChatUser.email}</div>
                        <div className={`${styles.chatTopBarStatus} ${selectedChatUser.status === "online" ? styles.chatTopBarStatusOnline : ""}`}>
                          {selectedChatUser.status === "online"
                            ? (lang === "ar" ? "متصل الآن" : lang === "fr" ? "En ligne" : "Online")
                            : (lang === "ar" ? "غير متصل" : lang === "fr" ? "Hors ligne" : "Offline")}
                        </div>
                      </div>
                    </div>
                  </div>

                  {chatBlockedByMe && <p className={styles.chatBlockedNote}>{t.chatsBlockedByMe}</p>}
                  {chatBlockedMe && <p className={styles.chatBlockedNote}>{t.chatsBlockedYou}</p>}
                  {chatError && <p className={styles.chatBlockedNote}>{chatError}</p>}

                  {/* Messages */}
                  <div className={styles.chatMessages} ref={chatScrollRef}>
                    {chatMessages.length === 0 ? (
                      <div className={styles.chatEmpty} style={{ flex: 1 }}>
                        <div>
                          <div style={{ fontSize: "2rem", marginBottom: "0.3rem" }}>👋</div>
                          <div style={{ fontSize: "0.8rem" }}>
                            {lang === "ar" ? "ابدأ المحادثة!" : lang === "fr" ? "Démarrez la conversation!" : "Start the conversation!"}
                          </div>
                        </div>
                      </div>
                    ) : (
                      chatMessages.map((message) => {
                        if (message.systemOnlyFor && message.systemOnlyFor !== myEmail && role !== "superadmin") {
                          return null;
                        }
                        const mine = message.senderEmail === myEmail;
                        const system = Boolean(message.systemOnlyFor);
                        return (
                          <div
                            key={message.id}
                            className={`${styles.chatMessageRow} ${system ? styles.chatMessageRowSystem : mine ? styles.chatMessageRowMine : styles.chatMessageRowOther}`}
                          >
                            <div
                              className={`${styles.chatBubble} ${system ? styles.chatBubbleSystem : mine ? styles.chatBubbleMine : styles.chatBubbleOther}`}
                            >
                              {message.text}
                              <div className={styles.chatTime}>
                                {formatChatDate(message.createdAt)}
                                {mine && <span className={styles.chatMsgStatus}>✓✓</span>}
                              </div>
                            </div>
                            {(mine || role === "superadmin") && (
                              <button
                                className={styles.chatDeleteMsgBtn}
                                onClick={() => deleteMessage(message.id)}
                                title={t.chatsDeleteMessage}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Composer */}
                  <div className={styles.chatComposer}>
                    <input
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendChatMessage();
                        }
                      }}
                      className={styles.chatInput}
                      placeholder={t.chatsWrite}
                      disabled={chatBlockedByMe || chatBlockedMe}
                    />
                    <button
                      className={styles.chatSendBtn}
                      onClick={sendChatMessage}
                      disabled={chatBlockedByMe || chatBlockedMe || !chatText.trim()}
                      title={t.chatsSend}
                    >
                      ➤
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      )}
      <ImageLightbox
        open={previewOpen}
        src={profileImage}
        alt="profile"
        onClose={() => setPreviewOpen(false)}
        onImageClick={() => {
          setPreviewOpen(false);
          profileInputRef.current?.click();
        }}
      />
    </section>
  );
}
