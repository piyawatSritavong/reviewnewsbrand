"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  FileText,
  Settings,
  Plus,
  Search,
  Edit3,
  Trash2,
  Image as ImageIcon,
  User,
  Heart,
  MessageCircle,
  LogOut,
  Bell,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Eye,
  Moon,
  Sun,
  Monitor,
  Cpu,
  Clock,
} from "lucide-react";

// --- Types ---
type Post = {
  id?: string;
  user: string;
  content: string;
  image: string;
  time: string;
  likes: string;
  comments: string;
};

type AutoConfig = {
  isEnabled: boolean;
  frequencyPerDay: number;
  topic: string;
  basePrompt: string;
  model: string;
  scheduledTimes: string[];
  wordLimit: 200 | 500 | 1000 | 2000;
};

// --- Configuration ---
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "http://localhost:8080/api";

// --- AI Prompt Pools (ใช้สุ่มทุกครั้งที่กด GENERATE) ---
const TOPIC_POOL: string[] = [
  "Interior Design",
  "Minimal Decor",
  "Luxury Home",
  "Small Space Living",
  "Smart Home",
  "Sustainable Design",
  "Modern Kitchen",
  "Bedroom Makeover",
  "Living Room Styling",
  "Home Office Setup",
];

const BASE_PROMPT_POOL: string[] = [
  "สร้างโพสต์สั้นๆ ให้ความรู้ + ทริคใช้งานได้จริง",
  "เขียนโพสต์แบบรีวิวก่อน-หลัง พร้อม bullet point",
  "สร้างโพสต์เชิง How-to เป็นขั้นตอน 1-5",
  "ทำโพสต์แนว FAQ 3 ข้อ + คำตอบสั้นๆ",
  "ทำโพสต์แนว checklist สำหรับคนเริ่มแต่งบ้าน",
  "เขียนโพสต์แนวเล่าเรื่อง (story) สั้นๆ แล้วสรุปข้อคิด",
  "ทำโพสต์แนวเปรียบเทียบ (A vs B) พร้อมข้อดีข้อเสีย",
  "สร้างโพสต์แนวแรงบันดาลใจ พร้อมคำแนะนำเชิงปฏิบัติ",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function applyWordLimitToPrompt(prompt: string, limit: number) {
  return `${prompt}\n\nข้อกำหนด: เขียนผลลัพธ์ไม่เกิน ${limit} คำ`;
}

function truncateWords(text: string, maxWords: number) {
  const cleaned = (text || "").trim();
  if (!cleaned) return "";
  const words = cleaned.split(/\s+/);
  if (words.length <= maxWords) return cleaned;
  return words.slice(0, maxWords).join(" ") + "…";
}

async function generateImageFromAPI(prompt: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return typeof data?.image === "string" ? data.image : "";
}

export default function Home() {
  const [imagePromptInput, setImagePromptInput] = useState<string>(
    "Realistic interior design photo, 16:9 aspect ratio, high quality, suitable for social post."
  );
  const [isAutoTesting, setIsAutoTesting] = useState(false);
  const [testResult, setTestResult] = useState<Post | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [countdown, setCountdown] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Post>({
    user: "",
    content: "",
    image: "",
    time: "เมื่อสักครู่",
    likes: "0",
    comments: "0",
  });

  const handleAiGenerate = async () => {
    if (!formData.content) {
      showNotification(
        "error",
        "กรุณาพิมพ์หัวข้อหรือคีย์เวิร์ดในช่องเนื้อหาก่อน",
      );
      return;
    }

    setIsAiGenerating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/generate-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: formData.content }),
      });

      if (res.ok) {
        const data = await res.json();
        const image = typeof data?.image === "string" ? data.image : "";
        const result =
          typeof data?.result === "string"
            ? data.result
            : typeof data?.content === "string"
              ? data.content
              : "";

        if (!result) throw new Error("Empty AI result");

        // fallback: ขอให้ backend generate รูปใหม่จากหัวข้อ/คีย์เวิร์ดเดิม
        let finalImage = image;
        if (!finalImage) {
          finalImage = await generateImageFromAPI(
            `Realistic high-quality photo, 16:9 aspect ratio, suitable for social post. Topic: ${formData.content}`,
          );
        }

        setFormData((prev) => ({
          ...prev,
          content: result,
          image: finalImage || prev.image,
        }));
        showNotification("success", "AI สร้างเนื้อหาให้เรียบร้อยแล้ว");
      } else {
        throw new Error("AI Generation failed");
      }
    } catch (err: unknown) {
      console.error(err);
      showNotification("error", "ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้");
    } finally {
      setIsAiGenerating(false);
    }
  };

  // --- API Functions with Fallback ---
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/posts`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to load posts: ${res.status}`);
      }

      const data = await res.json();

      // รองรับได้ทั้งกรณี backend ส่ง array ตรงๆ หรือส่งเป็น { posts: [...] }
      const list: Post[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.posts)
          ? data.posts
          : [];

      const normalized: Post[] = list.filter(Boolean).map((p: any) => ({
        id: typeof p?.id === "string" ? p.id : p?.id?.toString?.() || "",
        user: String(p?.user ?? ""),
        content: String(p?.content ?? ""),
        image: String(p?.image ?? ""),
        time: String(p?.time ?? ""),
        likes: String(p?.likes ?? "0"),
        comments: String(p?.comments ?? "0"),
      }));

      setPosts(normalized);
    } catch (err: unknown) {
      console.warn(
        "ไม่สามารถเชื่อมต่อกับ Backend ได้ หรือรูปแบบข้อมูลไม่ถูกต้อง",
        err,
      );
      showNotification("error", "โหลดโพสต์จากระบบไม่สำเร็จ");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingPost ? "PUT" : "POST";
    const url = editingPost
      ? `${API_BASE_URL}/posts/${editingPost.id}`
      : `${API_BASE_URL}/posts`;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        showNotification(
          "success",
          editingPost ? "อัปเดตโพสต์สำเร็จ" : "สร้างโพสต์ใหม่สำเร็จ",
        );
        fetchPosts();
        setIsModalOpen(false);
        resetForm();
      } else {
        throw new Error("Save failed");
      }
    } catch (err: unknown) {
      console.error(err);
      showNotification("error", "บันทึกโพสต์ไม่สำเร็จ (ตรวจสอบ API/Network)");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบโพสต์นี้?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/posts/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showNotification("success", "ลบโพสต์เรียบร้อยแล้ว");
        fetchPosts();
      } else {
        throw new Error("Delete failed");
      }
    } catch (err: unknown) {
      console.error(err);
      showNotification("error", "ลบโพสต์ไม่สำเร็จ (ตรวจสอบ API/Network)");
    }
  };

  const resetForm = () => {
    setFormData({
      user: "",
      content: "",
      image: "",
      time: "เมื่อสักครู่",
      likes: "0",
      comments: "0",
    });
    setEditingPost(null);
  };

  const openEdit = (post: Post) => {
    setEditingPost(post);
    setFormData(post);
    setIsModalOpen(true);
  };

  const openPreview = (post: Post) => {
    setPreviewPost(post);
    setIsPreviewOpen(true);
  };

  // --- AI Auto Configuration State ---
  const [autoConfig, setAutoConfig] = useState<AutoConfig>({
    isEnabled: false,
    frequencyPerDay: 3,
    topic: "Interior Design",
    basePrompt: "สร้างเนื้อหาเกี่ยวกับการออกแบบภายในที่ทันสมัย",
    model: "gemini-2.5-flash",
    scheduledTimes: ["09:00", "13:00", "20:00"], // ค่าเริ่มต้น
    wordLimit: 1000,
  });

  // โหลดค่า Config จาก Backend
  const fetchAutoConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auto-config`);
      if (res.ok) {
        const data: Partial<AutoConfig> = await res.json();

        const scheduledTimes = Array.isArray(data.scheduledTimes)
          ? data.scheduledTimes
              .map((t) => (typeof t === "string" ? t : ""))
              .filter(Boolean)
          : undefined;

        setAutoConfig((prev) => ({
          ...prev,
          ...data,
          scheduledTimes: scheduledTimes ?? prev.scheduledTimes,
        }));
      }
    } catch (err: unknown) {
      console.error("Failed to fetch auto config", err);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchAutoConfig(); // โหลด config เมื่อเปิดหน้า
  }, []);

  // --- Helper for AI Auto Preview/Save ---
  const resetPreview = () => {
    setTestResult(null);
    setIsAutoTesting(false);
    setIsSavingPost(false);
    setSaveState("idle");
    setCountdown(null);
  };

  const saveGeneratedPost = async (generatedContent: string) => {
    setIsSavingPost(true);
    setSaveState("saving");

    try {
      const payload: Post = {
        user: "Gemini AI Architect",
        content: generatedContent,
        image: (testResult?.image || formData.image || "").trim(),
        time: "เมื่อสักครู่",
        likes: "0",
        comments: "0",
      };

      const res = await fetch(`${API_BASE_URL}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Save post failed: ${res.status}`);

      setSaveState("saved");
      showNotification("success", "บันทึกเสร็จสิ้น");
      fetchPosts();

      // countdown แล้วปิด preview
      setCountdown(3);
      let t = 3;
      const timer = window.setInterval(() => {
        t -= 1;
        setCountdown(t);
        if (t <= 0) {
          window.clearInterval(timer);
          resetPreview();
        }
      }, 1000);
    } catch (e) {
      console.error(e);
      showNotification("error", "บันทึกโพสต์ไม่สำเร็จ");
      setSaveState("idle");
    } finally {
      setIsSavingPost(false);
    }
  };

  const handleSaveAutoConfig = async () => {
    setIsAutoTesting(true);
    setTestResult(null); // ล้างค่าเก่า

    // สุ่มหัวข้อหลักและ Base Prompt ใหม่ทุกครั้งที่กด GENERATE
    const randomizedTopic = pickRandom(TOPIC_POOL);
    const randomizedBasePrompt = pickRandom(BASE_PROMPT_POOL);

    // อัปเดต state ให้ UI เห็นค่าที่สุ่ม (สมูท)
    const nextConfig: AutoConfig = {
      ...autoConfig,
      topic: randomizedTopic,
      basePrompt: randomizedBasePrompt,
    };
    setAutoConfig(nextConfig);

    try {
      // 1) บันทึก Config ก่อน
      const configRes = await fetch(`${API_BASE_URL}/auto-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextConfig),
      });

      if (!configRes.ok) throw new Error("Save Config Failed");

      showNotification(
        "success",
        "บันทึกการตั้งค่าแล้ว... กำลังทดสอบ Generate โพสต์แรกให้คุณดู",
      );

      // 2) สั่ง Generate Content (Text Channel)
      const genRes = await fetch(`${API_BASE_URL}/generate-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: nextConfig.topic,
          basePrompt: applyWordLimitToPrompt(nextConfig.basePrompt, nextConfig.wordLimit),
          wordLimit: nextConfig.wordLimit,
        }),
      });

      if (!genRes.ok) throw new Error("Generate content failed");
      const data = await genRes.json();
      const content = typeof data?.result === "string" ? data.result : "";
      if (!content) throw new Error("Empty AI content");

      // 3) สั่ง Generate Image (Image Channel)
      const finalImage = await generateImageFromAPI(
        `${imagePromptInput}\nTopic: ${nextConfig.topic}\nStyle: ${nextConfig.basePrompt}`
      );

      setTestResult({
        user: "Gemini AI Architect",
        content,
        image: finalImage,
        time: "เมื่อสักครู่",
        likes: "0",
        comments: "0",
      });

      showNotification("success", "AI ทำงานได้ปกติ! ดูตัวอย่างได้ด้านล่าง");

      // ถ้าเปิดระบบอัตโนมัติ -> auto-save ทันที และซ่อนปุ่มยกเลิกใน UI
      if (nextConfig.isEnabled) {
        await saveGeneratedPost(content);
      }
    } catch (err: unknown) {
      showNotification("error", "การบันทึกหรือทดสอบระบบ AI ล้มเหลว");
      console.error(err);
    } finally {
      setIsAutoTesting(false);
    }
  };

  // ฟังก์ชันสำหรับจัดการการเปลี่ยนเวลาแต่ละช่อง
  const handleTimeChange = (index: number, newTime: string) => {
    setAutoConfig((prev) => {
      const updatedTimes = [...prev.scheduledTimes];
      updatedTimes[index] = newTime;
      return { ...prev, scheduledTimes: updatedTimes };
    });
  };

  // ฟังก์ชันเมื่อเปลี่ยนจำนวนความถี่ ให้ปรับขนาด Array ของเวลาตาม
  const handleFrequencyChange = (freq: number) => {
    setAutoConfig((prev) => {
      let newTimes = [...prev.scheduledTimes];
      if (freq > newTimes.length) {
        const diff = freq - newTimes.length;
        for (let i = 0; i < diff; i++) newTimes.push("12:00");
      } else {
        newTimes = newTimes.slice(0, freq);
      }
      return {
        ...prev,
        frequencyPerDay: freq,
        scheduledTimes: newTimes,
      };
    });
  };

  return (
    <div
      className={`min-h-screen font-sans flex transition-colors duration-500 ${isDarkMode ? "bg-[#0a0a0c] text-slate-300" : "bg-[#f8fafc] text-slate-600"}`}
    >
      {/* --- Sidebar --- */}
      <aside
        className={`flex w-72 border-r flex-col p-6 lg:flex transition-colors duration-500 ${isDarkMode ? "bg-black/40 border-white/5 backdrop-blur-xl" : "bg-white border-slate-200 shadow-xl"}`}
      >
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white font-black italic shadow-lg shadow-red-600/20">
            KP
          </div>
          <div>
            <h1
              className={`font-black uppercase leading-none ${isDarkMode ? "text-white" : "text-slate-800"}`}
            >
              Admin
            </h1>
            <p className="text-xs text-slate-500 uppercase font-bold">
              Management
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-3">
          {[
            { id: "posts", label: "จัดการโพสต์", icon: FileText },
            { id: "ai-auto", label: "AI-Auto Automation", icon: Cpu },
            { id: "settings", label: "ตั้งค่าระบบ", icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-bold text-sm ${
                activeTab === item.id
                  ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                  : `hover:bg-red-500/10 ${isDarkMode ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-red-600"}`
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div
          className={`pt-6 border-t ${isDarkMode ? "border-white/5" : "border-slate-100"}`}
        >
          <button className="w-full flex items-center gap-4 px-5 py-4 text-slate-500 hover:text-red-500 transition-all font-bold text-sm">
            <LogOut size={20} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header
          className={`h-24 border-b flex items-center justify-between px-8 transition-colors duration-500 ${isDarkMode ? "bg-black/20 border-white/5 backdrop-blur-md" : "bg-white/80 border-slate-200 backdrop-blur-md"}`}
        >
          <div
            className={`flex items-center gap-4 px-5 py-3 rounded-2xl border transition-all w-96 ${isDarkMode ? "bg-white/5 border-white/5" : "bg-slate-100 border-slate-200"}`}
          >
            <Search size={18} className="text-slate-500" />
            <input
              type="text"
              placeholder="ค้นหาโพสต์..."
              className="bg-transparent border-none outline-none text-sm w-full font-medium"
            />
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-3 rounded-2xl border transition-all ${isDarkMode ? "bg-white/5 border-white/10 text-yellow-400 hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"}`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button
              className={`relative p-3 rounded-2xl border transition-all ${isDarkMode ? "bg-white/5 border-white/10 text-slate-400 hover:text-white" : "bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800"}`}
            >
              <Bell size={20} />
              <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-black" />
            </button>

            <div
              className={`flex items-center gap-4 pl-6 border-l ${isDarkMode ? "border-white/10" : "border-slate-200"}`}
            >
              <div className="text-right hidden sm:block">
                <p
                  className={`text-xs font-black uppercase ${isDarkMode ? "text-white" : "text-slate-800"}`}
                >
                  Super Admin
                </p>
                <p className="text-xs text-green-500 font-bold uppercase">
                  Online Now
                </p>
              </div>
              <div
                className={`w-12 h-12 rounded-2xl border flex items-center justify-center overflow-hidden shadow-lg ${isDarkMode ? "bg-slate-800 border-white/10" : "bg-white border-slate-200"}`}
              >
                <User size={24} />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {activeTab === "posts" ? (
            <div className="max-w-6xl mx-auto space-y-5 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <h2
                    className={`text-5xl font-black italic uppercase mb-2 ${isDarkMode ? "text-white" : "text-slate-800"}`}
                  >
                    Feed Management
                  </h2>
                  <p className="text-slate-500 text-sm font-bold uppercase flex items-center gap-2 italic">
                    <Monitor size={16} className="text-red-600" />{" "}
                    ควบคุมและจัดการเนื้อหาในหน้าไทม์ไลน์
                  </p>
                </div>
                <button
                  onClick={() => {
                    resetForm();
                    setIsModalOpen(true);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs flex items-center gap-3 transition-all shadow-xl shadow-red-600/30 active:scale-95"
                >
                  <Plus size={20} /> สร้างโพสต์ใหม่
                </button>
              </div>

              <div
                className={`border rounded-2xl overflow-hidden transition-colors duration-500 ${isDarkMode ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-2xl shadow-slate-200/50"}`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr
                        className={`text-xs font-black uppercase ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}
                      >
                        <th className="px-4 py-6">ผู้โพสต์ / รูปภาพ</th>
                        <th className="px-4 py-6">เนื้อหาบรรยาย</th>
                        <th className="px-4 py-6">การตอบรับ</th>
                        <th className="px-4 py-6">วันที่แสดง</th>
                        <th className="px-4 py-6 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody
                      className={`divide-y ${isDarkMode ? "divide-white/5" : "divide-slate-100"}`}
                    >
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="py-24 text-center">
                            <Loader2
                              className="animate-spin mx-auto text-red-600"
                              size={48}
                            />
                            <p className="mt-6 text-xs font-bold uppercase opacity-40">
                              กำลังโหลดข้อมูล...
                            </p>
                          </td>
                        </tr>
                      ) : posts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-24 text-center">
                            <div className="opacity-20 mb-4 flex justify-center">
                              <FileText size={64} />
                            </div>
                            <p className="text-slate-500 font-bold italic uppercase">
                              ยังไม่มีข้อมูลโพสต์ในระบบ
                            </p>
                          </td>
                        </tr>
                      ) : (
                        posts.map((post, idx) => (
                          <tr
                            key={post.id || idx}
                            className={`transition-all group ${isDarkMode ? "hover:bg-white/5" : "hover:bg-slate-50"}`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-5">
                                <div
                                  className={`w-16 h-16 rounded-2xl overflow-hidden border shadow-xl shrink-0 group-hover:scale-105 transition-transform ${isDarkMode ? "border-white/10" : "border-slate-200"}`}
                                >
                                  <Image
                                    src={
                                      post.image ||
                                      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=200"
                                    }
                                    alt="post"
                                    width={64}
                                    height={64}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div>
                                  <p
                                    className={`font-black italic text-base ${isDarkMode ? "text-white" : "text-slate-800"}`}
                                  >
                                    {post.user}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <p className="text-xs font-bold text-slate-500 uppercase">
                                      Verified Content
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 max-w-xs">
                              <p
                                className={`text-sm line-clamp-2 italic font-medium leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                              >
                                {post.content}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-8">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="p-2 bg-red-500/10 rounded-xl">
                                    <Heart size={16} className="text-red-500" />
                                  </div>
                                  <span className="text-xs font-black">
                                    {post.likes}
                                  </span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                  <div className="p-2 bg-blue-500/10 rounded-xl">
                                    <MessageCircle
                                      size={16}
                                      className="text-blue-500"
                                    />
                                  </div>
                                  <span className="text-xs font-black">
                                    {post.comments}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-[11px] font-black text-slate-500 uppercase">
                                {post.time}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-3 transition-all">
                                <button
                                  onClick={() => openPreview(post)}
                                  className={`p-3 rounded-xl transition-all border ${isDarkMode ? "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500 hover:text-white" : "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-600 hover:text-white"}`}
                                  title="ดูตัวอย่าง"
                                >
                                  <Eye size={18} />
                                </button>
                                <button
                                  onClick={() => openEdit(post)}
                                  className={`p-3 rounded-xl transition-all border ${isDarkMode ? "bg-white/5 text-white border-white/10 hover:bg-white/20" : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"}`}
                                  title="แก้ไข"
                                >
                                  <Edit3 size={18} />
                                </button>
                                <button
                                  onClick={() => {
                                    if (!post.id) {
                                      showNotification(
                                        "error",
                                        "โพสต์นี้ไม่มี id จึงลบไม่ได้",
                                      );
                                      return;
                                    }
                                    handleDelete(post.id);
                                  }}
                                  className={`p-3 rounded-xl transition-all border ${isDarkMode ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-600 hover:text-white" : "bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white"}`}
                                  title="ลบ"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeTab === "ai-auto" ? (
            <div className="max-w-6xl mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col gap-2">
                <h2
                  className={`text-5xl font-black italic uppercase ${isDarkMode ? "text-white" : "text-slate-800"}`}
                >
                  AI Automation
                </h2>
                <p className="text-slate-500 text-sm font-bold uppercase flex items-center gap-2 italic">
                  <Cpu size={16} className="text-purple-600" /> ตั้งค่าระบบให้
                  AI คิดและโพสต์แทนคุณอัตโนมัติ
                </p>
              </div>

              <div
                className={`p-4 rounded-2xl border shadow-2xl transition-all ${isDarkMode ? "bg-white/5 border-white/5" : "bg-white border-slate-200"}`}
              >
                <div className="space-y-5">
                  {/* Toggle Switch */}
                  <div
                    className={`flex items-center justify-between p-6 rounded-2xl ${autoConfig.isEnabled ? "bg-purple-600/10 border border-purple-600/20" : "bg-slate-500/5 border border-slate-500/20"}`}
                  >
                    <div>
                      <p
                        className={`font-black text-lg ${autoConfig.isEnabled ? "text-purple-600" : "text-slate-500"} uppercase`}
                      >
                        {autoConfig.isEnabled
                          ? "เปิดใช้งานระบบอัตโนมัติ"
                          : "ปิดใช้งานระบบอัตโนมัติ"}
                      </p>
                      <p className="text-xs font-bold text-slate-500 uppercase">
                        AI จะทำงานตามความถี่ที่คุณกำหนด
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setAutoConfig({
                          ...autoConfig,
                          isEnabled: !autoConfig.isEnabled,
                        })
                      }
                      className={`w-16 h-8 rounded-full p-1 transition-all ${autoConfig.isEnabled ? "bg-green-500" : "bg-slate-400"}`}
                    >
                      <div
                        className={`w-6 h-6 bg-white rounded-full transition-all transform ${autoConfig.isEnabled ? "translate-x-8" : "translate-x-0"}`}
                      />
                    </button>
                  </div>

                  {/* ความถี่ และ การตั้งเวลา */}
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {/* ความถี่ */}
                      <div className="space-y-3">
                        <label className="text-xs font-black uppercase text-red-600 ml-2">
                          ความถี่ในการโพสต์ (ครั้ง/วัน)
                        </label>
                        <select
                          value={autoConfig.frequencyPerDay}
                          onChange={(e) =>
                            handleFrequencyChange(parseInt(e.target.value))
                          }
                          className={`w-full border rounded-2xl py-5 px-8 outline-none font-bold text-sm ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200"}`}
                        >
                          <option value={1}>1 ครั้ง ต่อวัน</option>
                          <option value={2}>2 ครั้ง ต่อวัน</option>
                          <option value={3}>3 ครั้ง ต่อวัน</option>
                          <option value={4}>4 ครั้ง ต่อวัน</option>
                        </select>
                      </div>

                      {/* เลือกโมเดล */}
                      <div className="space-y-3">
                        <label className="text-xs font-black uppercase text-red-600 ml-2">
                          AI Model
                        </label>
                        <div
                          className={`w-full border rounded-2xl py-5 px-8 flex items-center gap-3 font-bold text-sm ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200"}`}
                        >
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                          Gemini 1.5 Flash (Google)
                        </div>
                      </div>
                      {/* จำกัดจำนวนคำ */}
                      <div className="space-y-3">
                        <label className="text-xs font-black uppercase text-red-600 ml-2">
                          จำกัดคำ (Words Limit)
                        </label>
                        <select
                          value={autoConfig.wordLimit}
                          onChange={(e) =>
                            setAutoConfig({
                              ...autoConfig,
                              wordLimit: parseInt(
                                e.target.value,
                                10,
                              ) as AutoConfig["wordLimit"],
                            })
                          }
                          className={`w-full border rounded-2xl py-5 px-8 outline-none font-bold text-sm ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200"}`}
                        >
                          <option value={200}>200</option>
                          <option value={500}>500</option>
                          <option value={1000}>1,000</option>
                          <option value={2000}>2,000</option>
                        </select>
                      </div>
                    </div>

                    {/* Dynamic Time Slots */}
                    <div className="space-y-4">
                      <label className="text-xs font-black uppercase text-purple-600 ml-2 italic flex items-center gap-2">
                        <Clock size={14} /> กำหนดเวลาเผยแพร่ (
                        {autoConfig.frequencyPerDay} ช่วงเวลา)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {autoConfig.scheduledTimes.map(
                          (time: string, index: number) => (
                            <div
                              key={index}
                              className="space-y-2 animate-in zoom-in-95 duration-300"
                            >
                              <p className="text-[10px] font-black text-slate-500 uppercase ml-2">
                                ครั้งที่ {index + 1}
                              </p>
                              <input
                                type="time"
                                value={time || "00:00"}
                                onChange={(e) =>
                                  handleTimeChange(index, e.target.value)
                                }
                                className={`w-full border rounded-2xl py-4 px-5 outline-none font-bold text-sm transition-all focus:ring-2 focus:ring-purple-500/50 ${
                                  isDarkMode
                                    ? "bg-white/5 border-white/10 text-white"
                                    : "bg-white border-slate-200 shadow-sm"
                                }`}
                              />
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>

                  {/* หัวข้อหลัก */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-red-600 ml-2">
                      หัวข้อหลัก (Primary Topic)
                    </label>
                    <input
                      value={autoConfig.topic}
                      onChange={(e) =>
                        setAutoConfig({ ...autoConfig, topic: e.target.value })
                      }
                      placeholder="เช่น Luxury Home, Minimal Decor"
                      className={`w-full border rounded-2xl py-5 px-8 outline-none font-bold text-sm ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200"}`}
                    />
                  </div>

                  {/* Base Prompt */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-red-600 ml-2">
                      คำสั่งพื้นฐาน (Base Prompt for AI)
                    </label>
                    <textarea
                      rows={3}
                      value={autoConfig.basePrompt}
                      onChange={(e) =>
                        setAutoConfig({
                          ...autoConfig,
                          basePrompt: e.target.value,
                        })
                      }
                      className={`w-full border rounded-2xl py-6 px-8 outline-none font-medium italic resize-none ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200"}`}
                    />
                  </div>

                  {/* Image Prompt */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-red-600 ml-2">
                      รายละเอียดรูปภาพ (Image Prompt for AI)
                    </label>
                    <textarea
                      rows={3}
                      value={imagePromptInput}
                      onChange={(e) => setImagePromptInput(e.target.value)}
                      placeholder="อธิบายรูปที่ต้องการ เช่น mood, style, objects, scene..."
                      className={`w-full border rounded-2xl py-6 px-8 outline-none font-medium italic resize-none ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200"}`}
                    />
                    <p className="text-[11px] font-bold text-slate-500 ml-2">
                      ระบบจะส่ง prompt นี้ไปที่ /generate-image โดยแยกจากการสร้างบทความ
                    </p>
                  </div>

                  <button
                    onClick={handleSaveAutoConfig}
                    disabled={isAutoTesting}
                    className={`w-full py-6 rounded-2xl font-black uppercase shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
                      isAutoTesting
                        ? "bg-slate-600 text-white cursor-wait"
                        : "bg-purple-600 hover:bg-purple-700 text-white"
                    }`}
                  >
                    <Cpu size={24} />
                    {isAutoTesting ? "WORKING..." : "GENERATE"}
                  </button>

                  {/* --- AI Live Test Result Preview --- */}
                  {(isAutoTesting || testResult) && (
                    <div
                      className={`mt-10 p-8 rounded-2xl border animate-in slide-in-from-top-4 duration-500 ${isDarkMode ? "bg-white/5 border-white/10" : "bg-purple-50 border-purple-100"}`}
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-sm font-black uppercase italic text-purple-600 flex items-center gap-2">
                          <Monitor size={16} /> AI Test Result Preview
                        </h4>
                        {isAutoTesting && (
                          <span className="text-[10px] font-bold text-slate-500 animate-pulse">
                            AI IS THINKING...
                          </span>
                        )}
                      </div>

                      {isAutoTesting ? (
                        <div className="py-20 flex flex-col items-center gap-4">
                          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-xs font-black uppercase opacity-50 italic">
                            Gemini is processing your prompt...
                          </p>
                        </div>
                      ) : (
                        testResult && (
                          <div className="space-y-6">
                            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                              {testResult.image ? (
                                <Image
                                  src={testResult.image}
                                  alt="AI Test"
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div
                                  className={`w-full h-full flex items-center justify-center text-xs font-black uppercase ${isDarkMode ? "bg-white/5 text-slate-400" : "bg-white text-slate-500"}`}
                                >
                                  NO IMAGE GENERATED
                                </div>
                              )}
                            </div>

                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg">
                                  G
                                </div>
                                <p className="font-black italic text-sm">
                                  {testResult.user}
                                </p>
                              </div>

                              <div
                                className={`text-base font-medium leading-relaxed italic whitespace-pre-wrap break-words ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                              >
                                {testResult.content}
                              </div>

                              <div className="pt-4 border-t border-purple-200/50 flex gap-6 text-[10px] font-black opacity-50 uppercase">
                                <span>Status: Ready to Save</span>
                                <span>Topic: {autoConfig.topic}</span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-4">
                              {(() => {
                                const isAuto = autoConfig.isEnabled;
                                const isBusy = isAutoTesting || isSavingPost;
                                const saved = saveState === "saved";
                                const saving = saveState === "saving";
                                const showCancel =
                                  !isAuto && saveState === "idle";
                                const saveFull = isAuto || saveState !== "idle";

                                const saveLabel =
                                  countdown !== null && countdown > 0
                                    ? `ย้อนกลับใน ${countdown}`
                                    : saving
                                      ? "กำลังบันทึก..."
                                      : saved
                                        ? "บันทึกเสร็จสิ้น"
                                        : "บันทึก";

                                return (
                                  <div
                                    className={`grid gap-3 ${saveFull ? "grid-cols-1" : "grid-cols-2"}`}
                                  >
                                    <button
                                      type="button"
                                      disabled={
                                        isBusy ||
                                        (isAuto && (saving || saved)) ||
                                        countdown !== null
                                      }
                                      onClick={async () => {
                                        if (!testResult) return;
                                        // ปุ่มบันทึกใช้สำหรับกรณีปิดระบบอัตโนมัติ (และเป็นปุ่มสถานะสำหรับ auto)
                                        if (
                                          !autoConfig.isEnabled &&
                                          saveState === "idle"
                                        ) {
                                          await saveGeneratedPost(
                                            testResult.content,
                                          );
                                        }
                                      }}
                                      className={`w-full py-4 rounded-2xl font-black uppercase shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                        saving ||
                                        saved ||
                                        countdown !== null ||
                                        isAuto
                                          ? "bg-purple-600 text-white"
                                          : "bg-purple-600 hover:bg-purple-700 text-white"
                                      } ${isBusy ? "opacity-70 cursor-wait" : ""}`}
                                    >
                                      {(saving || isSavingPost) && (
                                        <Loader2
                                          className="animate-spin"
                                          size={18}
                                        />
                                      )}
                                      {saveLabel}
                                    </button>

                                    {showCancel && (
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() => {
                                          // ยกเลิก = ล้าง state preview เหมือนรีเฟรช
                                          resetPreview();
                                        }}
                                        className={`w-full py-4 rounded-2xl font-black uppercase shadow-xl transition-all active:scale-95 border ${isDarkMode ? "bg-white/5 border-white/10 text-white hover:bg-white/10" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                                      >
                                        ยกเลิก
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center space-y-6">
              <div
                className={`p-10 rounded-2xl border transition-all ${isDarkMode ? "bg-white/5 border-white/5" : "bg-white border-slate-200 shadow-2xl"}`}
              >
                <Settings
                  size={80}
                  className="text-red-600 mx-auto animate-spin-slow"
                />
                <div className="mt-8 text-center">
                  <h3
                    className={`text-2xl font-black italic uppercase ${isDarkMode ? "text-white" : "text-slate-800"}`}
                  >
                    System Settings
                  </h3>
                  <p className="text-slate-500 font-bold uppercase text-xs mt-2 italic">
                    แผงควบคุมการตั้งค่าระบบหลักกำลังอยู่ในการพัฒนา
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- CRUD Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-2xl"
            onClick={() => setIsModalOpen(false)}
          />

          <div
            className={`relative w-full max-w-2xl rounded-2xl p-12 border shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-500 ${isDarkMode ? "bg-[#121215] border-white/10 text-white" : "bg-white border-slate-200 text-slate-800"}`}
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-red-600 via-orange-500 to-red-600" />

            <div className="flex justify-between items-start mb-12">
              <div>
                <h3
                  className={`text-4xl font-black italic uppercase leading-none ${isDarkMode ? "text-white" : "text-slate-900"}`}
                >
                  {editingPost ? "ปรับปรุงข้อมูล" : "สร้างโพสต์ใหม่"}
                </h3>
                <p className="text-slate-500 text-xs font-black uppercase mt-3 italic">
                  กรุณาระบุรายละเอียดให้ครบถ้วนเพื่อผลลัพธ์ที่ดีที่สุด
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`p-4 rounded-2xl transition-all ${isDarkMode ? "bg-white/5 hover:bg-white/10" : "bg-slate-100 hover:bg-slate-200"}`}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase text-red-600 ml-2">
                    ชื่อผู้โพสต์ (Username)
                  </label>
                  <div className="relative">
                    <User
                      className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"
                      size={20}
                    />
                    <input
                      required
                      value={formData.user}
                      onChange={(e) =>
                        setFormData({ ...formData, user: e.target.value })
                      }
                      type="text"
                      placeholder="เช่น KP_Architect"
                      className={`w-full border rounded-2xl py-5 pl-16 pr-8 outline-none focus:ring-4 focus:ring-red-600/20 transition-all font-bold text-sm ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase text-red-600 ml-2">
                    เวลาที่แสดง (Display Time)
                  </label>
                  <input
                    value={formData.time}
                    onChange={(e) =>
                      setFormData({ ...formData, time: e.target.value })
                    }
                    type="text"
                    placeholder="เช่น 2 ชม. ที่แล้ว"
                    className={`w-full border rounded-2xl py-5 px-8 outline-none focus:ring-4 focus:ring-red-600/20 transition-all font-bold text-sm ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end ml-2">
                  <label className="text-xs font-black uppercase text-red-600">
                    เนื้อหาบรรยาย (Post Content)
                  </label>
                  {/* เพิ่มปุ่ม AI ตรงนี้ */}
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={isAiGenerating}
                    className={`flex items-center gap-2 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all ${
                      isAiGenerating
                        ? "bg-slate-500 text-white animate-pulse"
                        : "bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20"
                    }`}
                  >
                    {isAiGenerating ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Settings size={12} />
                    )}
                    {isAiGenerating ? "กำลังประมวลผล..." : "AI Generate"}
                  </button>
                </div>
                <textarea
                  required
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={4}
                  placeholder="พิมพ์หัวข้อสั้นๆ แล้วกด AI Generate หรือพิมพ์เนื้อหาเองที่นี่..."
                  className={`w-full border rounded-2xl py-6 px-8 outline-none focus:ring-4 focus:ring-red-600/20 transition-all font-medium text-base italic resize-none ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black uppercase text-red-600 ml-2">
                  ลิงก์รูปภาพ (Image URL)
                </label>
                <div className="relative">
                  <ImageIcon
                    className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"
                    size={20}
                  />
                  <input
                    required
                    value={formData.image}
                    onChange={(e) =>
                      setFormData({ ...formData, image: e.target.value })
                    }
                    type="text"
                    placeholder="https://images.unsplash.com/..."
                    className={`w-full border rounded-2xl py-5 pl-16 pr-8 outline-none focus:ring-4 focus:ring-red-600/20 transition-all font-bold text-sm ${isDarkMode ? "bg-white/5 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                  />
                </div>
              </div>

              <div className="pt-8">
                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-6 rounded-2xl font-black uppercase shadow-2xl shadow-red-600/40 transition-all flex items-center justify-center gap-4 active:scale-95"
                >
                  <CheckCircle2 size={24} />{" "}
                  {editingPost
                    ? "บันทึกการเปลี่ยนแปลง"
                    : "เผยแพร่โพสต์เดี๋ยวนี้"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Preview Modal --- */}
      {isPreviewOpen && previewPost && (
        <div className="fixed inset-0 z-250 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xl"
            onClick={() => setIsPreviewOpen(false)}
          />
          <div className="relative w-full max-w-lg max-h-[calc(100vh-3rem)] animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6 px-4">
              <h4 className="text-white font-black italic uppercase text-sm">
                Post Preview Mode
              </h4>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)] max-h-[calc(100vh-7rem)] flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-red-600 to-orange-400 flex items-center justify-center text-white font-black italic shadow-lg">
                      K
                    </div>
                    <div>
                      <h3 className="text-white font-black italic uppercase text-base leading-none mb-1">
                        {previewPost.user}
                      </h3>
                      <p className="text-white/40 text-[11px] font-bold uppercase">
                        {previewPost.time} • Public
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mx-6 my-2 rounded-2xl overflow-hidden border border-white/10 aspect-4/3 relative">
                  <Image
                    src={previewPost.image}
                    alt="preview"
                    fill
                    sizes="(max-width: 768px) 100vw, 560px"
                    className="object-cover"
                    priority
                  />
                </div>

                <div className="px-6 py-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 max-h-56 overflow-y-auto">
                    <div className="text-white/90 text-[16px] font-medium leading-relaxed italic whitespace-pre-wrap wrap-break-word">
                      {truncateWords(previewPost.content, 100)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-10 py-5 flex justify-between items-center text-white/50 border-t border-white/10 text-[11px] font-black uppercase bg-white/5">
                <div className="flex items-center gap-2">
                  <div className="bg-red-500 p-1.5 rounded-full">
                    <Heart size={10} className="fill-white text-white" />
                  </div>
                  <span>{previewPost.likes} Likes</span>
                </div>
                <span>{previewPost.comments} Comments</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Notification Toast --- */}
      {notification && (
        <div
          className={`fixed bottom-10 right-10 z-300 px-8 py-5 rounded-2xl border flex items-center gap-4 shadow-2xl animate-in slide-in-from-right duration-500 ${
            notification.type === "success"
              ? "bg-green-600 text-white border-green-400"
              : "bg-red-600 text-white border-red-400"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 size={24} />
          ) : (
            <AlertCircle size={24} />
          )}
          <span className="font-black italic uppercase text-sm">
            {notification.message}
          </span>
        </div>
      )}

      <style>
        {`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.1);
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        `}
      </style>
    </div>
  );
}
