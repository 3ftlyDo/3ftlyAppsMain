import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Settings, 
  X, 
  Search, 
  Trash2, 
  Shield, 
  User, 
  Activity,
  Database,
  RefreshCw,
  MoreVertical,
  ChevronRight,
  History,
  FileText
} from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc,
  updateDoc,
  addDoc,
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

interface AuditLog {
  id: string;
  action: string;
  adminId: string;
  adminEmail: string;
  targetId: string;
  details: string;
  timestamp: Timestamp;
}

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'audit'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersList);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'audit') return;

    const logsRef = collection(db, 'audit_logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
      setAuditLogs(logsList);
      setIsLoadingLogs(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'audit_logs');
      setIsLoadingLogs(false);
    });

    return () => unsubscribe();
  }, [isOpen, activeTab]);

  const filteredUsers = users.filter(user => 
    user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete === '3ftlyapps@gmail.com') return; // Protect main admin

    const targetUser = users.find(u => u.uid === userToDelete);

    try {
      await deleteDoc(doc(db, 'users', userToDelete));
      
      // Log the action
      if (auth.currentUser) {
        await addDoc(collection(db, 'audit_logs'), {
          action: 'DELETE_USER',
          adminId: auth.currentUser.uid,
          adminEmail: auth.currentUser.email,
          targetId: userToDelete,
          details: `Deleted user: ${targetUser?.email || userToDelete}`,
          timestamp: serverTimestamp()
        });
      }

      setUserToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userToDelete}`);
    }
  };

  const handleUpdateRole = async (uid: string, newRole: 'admin' | 'client') => {
    if (uid === '3ftlyapps@gmail.com') return; // Protect main admin
    
    const targetUser = users.find(u => u.uid === uid);
    if (!targetUser || targetUser.role === newRole) return;

    setIsUpdatingRole(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      
      // Log the action
      if (auth.currentUser) {
        await addDoc(collection(db, 'audit_logs'), {
          action: 'UPDATE_ROLE',
          adminId: auth.currentUser.uid,
          adminEmail: auth.currentUser.email,
          targetId: uid,
          details: `Changed role for ${targetUser.email} from ${targetUser.role} to ${newRole}`,
          timestamp: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    } finally {
      setIsUpdatingRole(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/90 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-6xl h-[90vh] bg-zinc-900 border border-zinc-800 rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                  <Shield className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Admin Console</h2>
                  <p className="text-xs text-zinc-500 font-medium">Manage your application ecosystem</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className="w-64 border-r border-zinc-800 p-4 hidden md:flex flex-col gap-2">
                <button 
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-blue-500/10 text-blue-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                >
                  <Users className="w-4 h-4" /> Users
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-blue-500/10 text-blue-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                >
                  <Settings className="w-4 h-4" /> Settings
                </button>
                <button 
                  onClick={() => setActiveTab('audit')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'audit' ? 'bg-blue-500/10 text-blue-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                >
                  <History className="w-4 h-4" /> Audit Logs
                </button>
                
                <div className="mt-auto p-4 bg-zinc-800/30 rounded-2xl border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">System Status</span>
                  </div>
                  <p className="text-xs font-medium text-zinc-300">All systems operational</p>
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950/30">
                {activeTab === 'users' ? (
                  <>
                    {/* Users Toolbar */}
                    <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input 
                          type="text" 
                          placeholder="Search users..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
                        />
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold transition-all">
                          <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                      </div>
                    </div>

                    {/* Users List */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      {isLoading ? (
                        <div className="flex flex-col gap-2">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-16 bg-zinc-900/50 rounded-xl animate-pulse" />
                          ))}
                        </div>
                      ) : filteredUsers.length > 0 ? (
                        <div className="space-y-2">
                          {filteredUsers.map((u) => (
                            <div 
                              key={u.uid}
                              className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-all group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full overflow-hidden border border-zinc-800">
                                  {u.photoURL ? (
                                    <img src={u.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                      <User className="w-5 h-5 text-zinc-600" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold">{u.displayName || 'Anonymous User'}</h4>
                                  <p className="text-xs text-zinc-500">{u.email}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className="hidden sm:flex flex-col items-end">
                                  <div className="flex items-center gap-2">
                                    {isUpdatingRole === u.uid ? (
                                      <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                                    ) : (
                                      <select
                                        value={u.role}
                                        onChange={(e) => handleUpdateRole(u.uid, e.target.value as 'admin' | 'client')}
                                        disabled={u.email === '3ftlyapps@gmail.com' || isUpdatingRole === u.uid}
                                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border bg-transparent cursor-pointer focus:outline-none transition-all ${u.role === 'admin' ? 'text-blue-500 border-blue-500/20 hover:bg-blue-500/5' : 'text-zinc-500 border-zinc-700 hover:bg-zinc-800'}`}
                                      >
                                        <option value="client" className="bg-zinc-900 text-zinc-300">Client</option>
                                        <option value="admin" className="bg-zinc-900 text-zinc-300">Admin</option>
                                      </select>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-zinc-600 mt-1">
                                    Joined {u.createdAt?.toDate().toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => setUserToDelete(u.uid)}
                                    disabled={u.email === '3ftlyapps@gmail.com'}
                                    className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all disabled:opacity-0"
                                    title="Delete User"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                  <button className="p-2 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded-lg transition-all">
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
                            <Users className="w-6 h-6 text-zinc-700" />
                          </div>
                          <h3 className="text-lg font-bold">No users found</h3>
                          <p className="text-zinc-500 text-sm">Try a different search term</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : activeTab === 'audit' ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <History className="w-4 h-4 text-blue-500" /> System Audit Logs
                      </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      {isLoadingLogs ? (
                        <div className="space-y-2">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-12 bg-zinc-900/50 rounded-xl animate-pulse" />
                          ))}
                        </div>
                      ) : auditLogs.length > 0 ? (
                        <div className="space-y-2">
                          {auditLogs.map((log) => (
                            <div 
                              key={log.id}
                              className="flex items-center justify-between p-3 bg-zinc-900/30 border border-zinc-800/50 rounded-xl text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                                  <FileText className="w-4 h-4 text-zinc-500" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-zinc-300">{log.action}</span>
                                    <span className="text-zinc-600">•</span>
                                    <span className="text-zinc-500">{log.adminEmail}</span>
                                  </div>
                                  <p className="text-zinc-400 mt-0.5">{log.details}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-zinc-500 font-medium">
                                  {log.timestamp?.toDate().toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                          <History className="w-12 h-12 text-zinc-800 mb-4" />
                          <h3 className="text-lg font-bold">No logs yet</h3>
                          <p className="text-zinc-500 text-sm">Administrative actions will appear here</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 max-w-2xl mx-auto w-full space-y-8">
                    <div>
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-500" /> Application Settings
                      </h3>
                      
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                          <div>
                            <h4 className="text-sm font-bold">Maintenance Mode</h4>
                            <p className="text-xs text-zinc-500">Disable all client access temporarily</p>
                          </div>
                          <button className="w-12 h-6 bg-zinc-800 rounded-full relative p-1 transition-colors">
                            <div className="w-4 h-4 bg-zinc-600 rounded-full" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                          <div>
                            <h4 className="text-sm font-bold">New User Registration</h4>
                            <p className="text-xs text-zinc-500">Allow new users to sign up</p>
                          </div>
                          <button className="w-12 h-6 bg-blue-600 rounded-full relative p-1 transition-colors">
                            <div className="w-4 h-4 bg-white rounded-full ml-auto" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                          <div>
                            <h4 className="text-sm font-bold">Debug Logging</h4>
                            <p className="text-xs text-zinc-500">Enable verbose server-side logs</p>
                          </div>
                          <button className="w-12 h-6 bg-zinc-800 rounded-full relative p-1 transition-colors">
                            <div className="w-4 h-4 bg-zinc-600 rounded-full" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-zinc-800">
                      <button className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20">
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <ConfirmationModal
            isOpen={!!userToDelete}
            title="Delete User"
            message="Are you sure you want to delete this user? This action cannot be undone and will remove all associated profile data."
            confirmLabel="Delete User"
            onConfirm={handleDeleteUser}
            onCancel={() => setUserToDelete(null)}
            variant="danger"
          />
        </div>
      )}
    </AnimatePresence>
  );
};
