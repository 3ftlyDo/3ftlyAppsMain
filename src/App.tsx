/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layout, 
  Box, 
  Mail, 
  Github, 
  ExternalLink, 
  ChevronRight, 
  Menu, 
  X, 
  Zap, 
  Shield, 
  Smartphone,
  Send,
  ChevronDown,
  Grid3X3,
  Search,
  HelpCircle,
  User as UserIcon,
  ArrowLeft,
  Share2,
  Download,
  Info,
  LogOut,
  LogIn,
  Settings,
  ShieldCheck,
  MessageCircle
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AdminDashboard } from './components/AdminDashboard';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';

interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: 'admin' | 'client';
  createdAt: Timestamp;
}

interface Artifact {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  tags: string[];
}

const ARTIFACTS: Artifact[] = [
  {
    id: '1',
    title: 'TaskFlow',
    description: 'Streamline your workflow with an intuitive task management system designed for speed and clarity.',
    category: 'Productivity',
    icon: <Zap className="w-6 h-6 text-blue-500" />,
    tags: ['React', 'Tailwind', 'Motion']
  },
  {
    id: '2',
    title: 'ZenSpace',
    description: 'A minimalist meditation and focus app to help you find your calm in a busy world.',
    category: 'Wellness',
    icon: <Shield className="w-6 h-6 text-emerald-500" />,
    tags: ['Audio', 'PWA', 'Offline']
  },
  {
    id: '3',
    title: 'DataViz Pro',
    description: 'Powerful data visualization tools that turn complex datasets into beautiful, actionable insights.',
    category: 'Analytics',
    icon: <Layout className="w-6 h-6 text-purple-500" />,
    tags: ['D3.js', 'Recharts', 'SVG']
  },
  {
    id: '4',
    title: 'MobileFirst',
    description: 'A framework-agnostic approach to building lightning-fast mobile-first web applications.',
    category: 'Developer Tools',
    icon: <Smartphone className="w-6 h-6 text-orange-500" />,
    tags: ['CSS', 'Performance', 'A11y']
  }
];

const FAQ_ITEMS = [
  {
    question: "What is 3ftly Apps?",
    answer: "3ftly Apps is a creative studio focused on building high-performance, user-centric digital artifacts and applications that solve real-world problems with elegant design."
  },
  {
    question: "How can I use these artifacts?",
    answer: "Most of our artifacts are available as open-source templates or live demos. You can explore them in our Artifacts section and follow the links to their respective repositories."
  },
  {
    question: "Are these apps free to use?",
    answer: "Yes, the artifacts showcased here are free to explore and use as inspiration or templates for your own projects. Some premium services may be offered for custom integrations."
  },
  {
    question: "Do you offer custom development?",
    answer: "Absolutely! We love collaborating on unique projects. Reach out via our contact form to discuss your ideas and how we can help bring them to life."
  },
  {
    question: "How often are new artifacts added?",
    answer: "We strive to release new digital artifacts regularly as we experiment with new technologies and design patterns. Stay tuned for our latest updates!"
  }
];

const DottedGrid = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="6" cy="6" r="1.75" />
    <circle cx="12" cy="6" r="1.75" />
    <circle cx="18" cy="6" r="1.75" />
    <circle cx="6" cy="12" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="18" cy="12" r="1.75" />
    <circle cx="6" cy="18" r="1.75" />
    <circle cx="12" cy="18" r="1.75" />
    <circle cx="18" cy="18" r="1.75" />
  </svg>
);

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAppDrawerOpen, setIsAppDrawerOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [activeSection, setActiveSection] = useState('home');
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(true);
  const [isLoadingFaq, setIsLoadingFaq] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    }
  };

  // Auth & Profile State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (!currentUser) {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthReady) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        setUserProfile(snapshot.data() as UserProfile);
      } else {
        // Create profile if it doesn't exist
        const isAdminEmail = user.email === '3ftlyapps@gmail.com';
        const newProfile: Partial<UserProfile> = {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          role: isAdminEmail ? 'admin' : 'client',
          createdAt: serverTimestamp() as Timestamp,
        };
        setDoc(userRef, newProfile).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setIsProfileMenuOpen(false);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const filteredArtifacts = ARTIFACTS.filter(artifact => {
    const query = searchQuery.toLowerCase();
    return (
      artifact.title.toLowerCase().includes(query) ||
      artifact.description.toLowerCase().includes(query) ||
      artifact.tags.some(tag => tag.toLowerCase().includes(query))
    );
  });

  useEffect(() => {
    // Simulate initial load
    const timer = setTimeout(() => {
      setIsLoadingArtifacts(false);
      setIsLoadingFaq(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setIsLoadingArtifacts(true);
      const timer = setTimeout(() => setIsLoadingArtifacts(false), 600);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      
      const sections = ['home', 'artifacts', 'faq', 'contact'];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsSidebarOpen(false);
    setIsAppDrawerOpen(false);
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-blue-500/30">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/50 py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Sidebar Toggle Icon (Left) */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
              title="Main Menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div 
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => scrollTo('home')}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:rotate-6 transition-transform shadow-lg shadow-blue-500/20">
                <Box className="text-white w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tight hidden sm:block">3ftly <span className="text-blue-500">Apps</span></span>
            </div>
          </div>

          {/* Search Bar (Google Style) */}
          <div className="hidden lg:flex flex-1 max-w-md mx-8">
            <div className="w-full relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search artifacts..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-full py-2 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-zinc-900 transition-all"
              />
            </div>
          </div>

          {/* Desktop Menu & App Drawer Toggle (Right) */}
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors lg:hidden"
            >
              <Search className="w-5 h-5" />
            </button>

            <div className="hidden md:flex items-center gap-4 mr-2 border-r border-zinc-800 pr-4">
              {['home', 'artifacts', 'faq', 'contact'].map((item) => (
                <button
                  key={item}
                  onClick={() => scrollTo(item)}
                  className={`capitalize text-xs font-bold tracking-widest transition-colors hover:text-blue-400 ${activeSection === item ? 'text-blue-500' : 'text-zinc-500'}`}
                >
                  {item}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-1 md:gap-2">
              <button className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors hidden sm:flex">
                <HelpCircle className="w-5 h-5" />
              </button>
              
              {/* Google-style App Drawer Icon (Right) */}
              <button 
                onClick={() => setIsAppDrawerOpen(!isAppDrawerOpen)}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors relative"
                title="App Drawer"
              >
                <DottedGrid className={`w-5 h-5 ${isAppDrawerOpen ? 'text-blue-500' : 'text-zinc-400'}`} />
              </button>

              <div className="relative">
                <button 
                  onClick={() => user ? setIsProfileMenuOpen(!isProfileMenuOpen) : handleSignIn()}
                  className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-700 transition-colors border border-zinc-700 ml-1 overflow-hidden group"
                >
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="w-4 h-4 group-hover:text-white transition-colors" />
                  )}
                </button>

                {/* Profile Dropdown */}
                <AnimatePresence>
                  {isProfileMenuOpen && user && (
                    <>
                      <div 
                        className="fixed inset-0 z-[60]" 
                        onClick={() => setIsProfileMenuOpen(false)} 
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-[70] overflow-hidden"
                      >
                        <div className="p-6 text-center border-b border-zinc-800">
                          <div className="w-16 h-16 bg-zinc-800 rounded-full mx-auto mb-4 overflow-hidden border-2 border-zinc-700">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <UserIcon className="w-8 h-8 m-4 text-zinc-500" />
                            )}
                          </div>
                          <h3 className="font-bold text-lg">{user.displayName || 'User'}</h3>
                          <p className="text-xs text-zinc-500 mb-2">{user.email}</p>
                          {userProfile?.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
                              <ShieldCheck className="w-3 h-3" /> Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider border border-zinc-700">
                              Client
                            </span>
                          )}
                        </div>
                        <div className="p-2">
                          {userProfile?.role === 'admin' && (
                            <button 
                              onClick={() => {
                                setIsAdminDashboardOpen(true);
                                setIsProfileMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-blue-400 hover:bg-blue-400/10 transition-all"
                            >
                              <Shield className="w-4 h-4" /> Admin Console
                            </button>
                          )}
                          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all">
                            <Settings className="w-4 h-4" /> Manage Account
                          </button>
                          <button 
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-400/10 transition-all"
                          >
                            <LogOut className="w-4 h-4" /> Sign Out
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar Expansion */}
        <AnimatePresence>
          {isMobileSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden px-4 pb-4 overflow-hidden"
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Search artifacts..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
                  autoFocus
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Sidebar Overlay & Drawer (Left) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 z-[70] w-[85vw] max-w-[300px] bg-zinc-900 border-r border-zinc-800 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Box className="text-blue-500 w-6 h-6" />
                  <span className="text-xl font-bold tracking-tight">3ftly <span className="text-blue-500">Apps</span></span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
                {['home', 'artifacts', 'faq', 'contact'].map((item) => (
                  <button
                    key={item}
                    onClick={() => scrollTo(item)}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold capitalize transition-all ${activeSection === item ? 'bg-blue-500/10 text-blue-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${activeSection === item ? 'bg-blue-500' : 'bg-transparent'}`} />
                    {item}
                  </button>
                ))}
              </div>

              <div className="p-6 border-t border-zinc-800">
                <div className="bg-zinc-800/50 rounded-2xl p-4 border border-zinc-800">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Storage</p>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden mb-2">
                    <div className="h-full w-2/3 bg-blue-500" />
                  </div>
                  <p className="text-[10px] text-zinc-400">10.2 GB of 15 GB used</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* App Drawer Overlay (Google Style - Right) */}
      <AnimatePresence>
        {isAppDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAppDrawerOpen(false)}
              className="fixed inset-0 z-[55] bg-black/10"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10, x: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10, x: 10 }}
              className="fixed top-16 right-4 md:right-6 z-[60] w-[calc(100%-32px)] sm:w-[320px] bg-zinc-900 border border-zinc-800 rounded-[28px] shadow-2xl overflow-hidden"
            >
              <div className="p-4 sm:p-6 grid grid-cols-3 gap-2 max-h-[60vh] sm:max-h-[400px] overflow-y-auto custom-scrollbar">
                {ARTIFACTS.map((app) => (
                  <button 
                    key={app.id}
                    onClick={() => {
                      setSelectedArtifact(app);
                      setIsAppDrawerOpen(false);
                    }}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-zinc-800 transition-all group"
                  >
                    <div className="w-14 h-14 bg-zinc-800/50 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform border border-zinc-800 group-hover:border-zinc-700 shadow-sm">
                      {app.icon}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white truncate w-full text-center">
                      {app.title}
                    </span>
                  </button>
                ))}
                {/* Mock Apps */}
                {[
                  { icon: <Mail className="w-6 h-6 text-zinc-500" />, title: "Mail" },
                  { icon: <Github className="w-6 h-6 text-zinc-500" />, title: "GitHub" },
                  { icon: <MessageCircle className="w-6 h-6 text-zinc-500" />, title: "WhatsApp" },
                  { icon: <Layout className="w-6 h-6 text-zinc-500" />, title: "Drive" },
                  { icon: <Shield className="w-6 h-6 text-zinc-500" />, title: "Admin" }
                ].map((mock, i) => (
                  <button key={i} className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-zinc-800 transition-all group opacity-60">
                    <div className="w-14 h-14 bg-zinc-800/50 rounded-2xl flex items-center justify-center border border-zinc-800">
                      {mock.icon}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 truncate w-full text-center">{mock.title}</span>
                  </button>
                ))}
              </div>
              <div className="p-4 bg-zinc-800/30 border-t border-zinc-800 text-center">
                <button 
                  onClick={() => scrollTo('artifacts')}
                  className="text-xs font-bold text-blue-500 hover:bg-blue-500/10 px-4 py-2 rounded-full transition-all"
                >
                  More from 3ftly Apps
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Artifact Details Modal */}
      <AnimatePresence>
        {selectedArtifact && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedArtifact(null)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
            />
            <motion.div
              layoutId={`artifact-${selectedArtifact.id}`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row"
            >
              <button 
                onClick={() => setSelectedArtifact(null)}
                className="absolute top-4 right-4 md:top-6 md:right-6 z-10 p-2 bg-zinc-800/80 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition-all shadow-lg backdrop-blur-sm"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Left: Visual/Icon */}
              <div className="w-full md:w-2/5 bg-gradient-to-br from-zinc-800 to-zinc-900 p-8 md:p-12 flex flex-col items-center justify-center relative overflow-hidden min-h-[240px] md:min-h-0">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                  <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-blue-500/20" />
                </div>
                <motion.div 
                  initial={{ scale: 0.8, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="w-32 h-32 bg-zinc-800 rounded-[40px] flex items-center justify-center shadow-2xl border border-zinc-700 mb-8 relative z-10"
                >
                  {React.cloneElement(selectedArtifact.icon as React.ReactElement, { className: "w-16 h-16" })}
                </motion.div>
                <div className="text-center relative z-10">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500 mb-2 block">
                    {selectedArtifact.category}
                  </span>
                  <h2 className="text-3xl font-bold tracking-tight">{selectedArtifact.title}</h2>
                </div>
              </div>

              {/* Modal Right: Content */}
              <div className="w-full md:w-3/5 p-6 md:p-12 flex flex-col max-h-[60vh] md:max-h-none overflow-y-auto md:overflow-visible">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-8 text-zinc-500">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Info className="w-4 h-4" /> Version 1.2.0
                    </div>
                    <div className="w-1 h-1 bg-zinc-800 rounded-full" />
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Smartphone className="w-4 h-4" /> Mobile Ready
                    </div>
                  </div>

                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">About the Artifact</h3>
                  <p className="text-zinc-300 leading-relaxed mb-8 text-lg">
                    {selectedArtifact.description} 
                    Experience the next level of {selectedArtifact.category.toLowerCase()} with our cutting-edge implementation.
                  </p>

                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">Technologies Used</h3>
                  <div className="flex flex-wrap gap-2 mb-10">
                    {selectedArtifact.tags.map(tag => (
                      <span key={tag} className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-300">
                        {tag}
                      </span>
                    ))}
                    <span className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-300">TypeScript</span>
                    <span className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-300">Vite</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]">
                    Launch Artifact <ExternalLink className="w-5 h-5" />
                  </button>
                  <div className="flex gap-2">
                    <button className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-400 hover:text-white transition-all border border-zinc-700">
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button className="p-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-400 hover:text-white transition-all border border-zinc-700">
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main>
        {/* Hero Section */}
        <section id="home" className="relative min-h-screen flex items-center pt-20 overflow-hidden">
          {/* Background Elements */}
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
          
          <div className="max-w-7xl mx-auto px-6 relative z-10">
            <div className="max-w-3xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <span className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold tracking-widest uppercase mb-6 border border-blue-500/20">
                  Welcome to the Hub
                </span>
                <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-[0.9] mb-8">
                  Crafting Digital <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                    Artifacts for Tomorrow
                  </span>
                </h1>
                <p className="text-xl text-zinc-400 leading-relaxed mb-10 max-w-2xl">
                  3ftly Apps is a creative studio dedicated to building high-performance, 
                  user-centric applications that solve real-world problems with elegant design.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={() => scrollTo('artifacts')}
                    className="bg-white text-zinc-950 px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:bg-zinc-200 transition-all hover:scale-105 active:scale-95"
                  >
                    Explore Artifacts <ChevronRight className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => scrollTo('contact')}
                    className="bg-zinc-900 border border-zinc-800 text-white px-8 py-4 rounded-full font-bold hover:bg-zinc-800 transition-all"
                  >
                    Get in Touch
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Artifacts Section */}
        <section id="artifacts" className="py-32 bg-zinc-900/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Featured Artifacts</h2>
                <p className="text-zinc-400 max-w-xl">
                  A curated collection of our latest work, ranging from productivity tools to immersive data experiences.
                </p>
              </div>
              <div className="flex gap-2">
                <div className="px-4 py-2 rounded-full bg-zinc-800 text-xs font-bold text-zinc-400">All</div>
                <div className="px-4 py-2 rounded-full hover:bg-zinc-800 text-xs font-bold text-zinc-500 transition-colors cursor-pointer">Productivity</div>
                <div className="px-4 py-2 rounded-full hover:bg-zinc-800 text-xs font-bold text-zinc-500 transition-colors cursor-pointer">Design</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {isLoadingArtifacts ? (
                // Skeleton Loaders
                [1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-[32px] p-8 animate-pulse">
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 bg-zinc-800 rounded-2xl" />
                      <div className="w-20 h-6 bg-zinc-800 rounded-full" />
                    </div>
                    <div className="w-2/3 h-8 bg-zinc-800 rounded-lg mb-4" />
                    <div className="w-full h-4 bg-zinc-800 rounded-lg mb-2" />
                    <div className="w-4/5 h-4 bg-zinc-800 rounded-lg mb-8" />
                    <div className="flex gap-2 mb-8">
                      <div className="w-12 h-6 bg-zinc-800 rounded-lg" />
                      <div className="w-12 h-6 bg-zinc-800 rounded-lg" />
                    </div>
                    <div className="w-24 h-4 bg-zinc-800 rounded-lg" />
                  </div>
                ))
              ) : filteredArtifacts.length > 0 ? (
                filteredArtifacts.map((artifact, index) => (
                  <motion.div
                    key={artifact.id}
                    layoutId={`artifact-${artifact.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => setSelectedArtifact(artifact)}
                    className="group relative bg-zinc-900/50 border border-zinc-800 rounded-[32px] p-8 hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/10 cursor-pointer overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] group-hover:bg-blue-500/10 transition-colors" />
                    
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-4 bg-zinc-800 rounded-2xl group-hover:bg-blue-500/10 group-hover:scale-110 transition-all border border-zinc-700 group-hover:border-blue-500/30">
                        {artifact.icon}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-800/50 px-3 py-1 rounded-full border border-zinc-800">
                        {artifact.category}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold mb-3 group-hover:text-blue-400 transition-colors">{artifact.title}</h3>
                    <p className="text-zinc-400 mb-6 leading-relaxed line-clamp-2">
                      {artifact.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-8">
                      {artifact.tags.map(tag => (
                        <span key={tag} className="text-[10px] font-bold text-zinc-500 border border-zinc-800 px-2.5 py-1 rounded-lg bg-zinc-950/50">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-blue-500 group-hover:gap-3 transition-all">
                      Learn More <ChevronRight className="w-4 h-4" />
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center">
                  <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-800">
                    <Search className="w-6 h-6 text-zinc-600" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No artifacts found</h3>
                  <p className="text-zinc-500">Try adjusting your search query to find what you're looking for.</p>
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="mt-6 text-blue-500 font-bold hover:text-blue-400 transition-colors"
                  >
                    Clear Search
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-32">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Frequently Asked Questions</h2>
              <p className="text-zinc-400">
                Everything you need to know about 3ftly Apps and our digital artifacts.
              </p>
            </div>

            <div className="space-y-4">
              {isLoadingFaq ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-zinc-900/20 border border-zinc-800 rounded-2xl animate-pulse" />
                ))
              ) : (
                FAQ_ITEMS.map((item, index) => (
                  <div 
                    key={index}
                    className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/20"
                  >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="font-bold">{item.question}</span>
                    <motion.div
                      animate={{ rotate: openFaqIndex === index ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ChevronDown className="w-5 h-5 text-zinc-500" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {openFaqIndex === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="px-6 pb-6 text-zinc-400 leading-relaxed border-t border-zinc-800 pt-4">
                          {item.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )))
            }
          </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-32 relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">Let's build something <br />extraordinary.</h2>
                <p className="text-xl text-zinc-400 mb-12 leading-relaxed">
                  Have an idea for a digital artifact? We're always looking for new challenges and collaborations.
                </p>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
                      <Mail className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Email</p>
                      <p className="text-lg font-medium">3ftlyapps@gmail.com</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
                      <MessageCircle className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">WhatsApp</p>
                      <p className="text-lg font-medium">+263 787 873 734</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 md:p-10">
                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Name</label>
                      <input 
                        type="text" 
                        placeholder="John Doe"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Email</label>
                      <input 
                        type="email" 
                        placeholder="john@example.com"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Message</label>
                    <textarea 
                      rows={4}
                      placeholder="Tell us about your project..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                    />
                  </div>
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                    Send Message <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-zinc-900">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <Box className="text-blue-500 w-5 h-5" />
            <span className="font-bold tracking-tight">3ftly Apps</span>
          </div>
          
          <div className="text-zinc-500 text-sm">
            © {new Date().getFullYear()} 3ftly Apps. All rights reserved.
          </div>

          <div className="flex items-center gap-6">
            <a href="https://github.com/3ftlyDo" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
            <a href="https://wa.me/263787873734" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors"><MessageCircle className="w-5 h-5" /></a>
            <a href="mailto:3ftlyapps@gmail.com" className="text-zinc-500 hover:text-white transition-colors"><Mail className="w-5 h-5" /></a>
          </div>
        </div>
      </footer>

      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 z-[120] bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                <Smartphone className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-bold">Install 3ftly Apps</p>
                <p className="text-[10px] text-zinc-500">Add to your home screen for quick access</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="text-xs font-bold text-zinc-500 hover:text-white px-2 py-1 transition-colors"
              >
                Later
              </button>
              <button 
                onClick={handleInstallClick}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all"
              >
                Install
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AdminDashboard 
        isOpen={isAdminDashboardOpen} 
        onClose={() => setIsAdminDashboardOpen(false)} 
      />
    </div>
    </ErrorBoundary>
  );
}
