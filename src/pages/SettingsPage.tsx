import React, { useState } from 'react';
import { Download, Trash2, ShieldAlert, CheckCircle2, Loader2, Settings as SettingsIcon, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useDbLookup } from '../context/DbLookupContext';
import { firestoreService } from '../firestoreService';
import JSZip from 'jszip';

export const SettingsPage: React.FC = () => {
  const { persons, parties, alliances, assemblies, constituencies, orders } = useDbLookup();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [captchaValue, setCaptchaValue] = useState('');
  const [userInput, setUserInput] = useState('');
  const [clearError, setClearError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  const generateCaptcha = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleOpenClearModal = () => {
    setCaptchaValue(generateCaptcha());
    setUserInput('');
    setClearError(null);
    setShowClearModal(true);
  };

  const handleClearData = async () => {
    const trimmedInput = userInput.trim();
    if (trimmedInput !== captchaValue) {
      setClearError('Invalid verification code. Please try again.');
      return;
    }

    setIsClearing(true);
    setClearError(null);
    try {
      console.log("Initiating full database purge...");
      await firestoreService.clearAllData();
      console.log("Database purge successful.");
      
      // Briefly show success before redirecting
      setTimeout(() => {
        window.location.href = '/?reset=success';
      }, 1000);
    } catch (err: any) {
      console.error("Purge failed:", err);
      setClearError(err.message || 'Failed to clear database. Please check your connection and permissions.');
      setIsClearing(false);
    }
  };

  const handleDownloadImages = async () => {
    setIsDownloading(true);
    const zip = new JSZip();
    
    // Collect all unique image URLs and metadata
    const imageUrls = new Map<string, { name: string; folder: string }>();

    persons.forEach(p => {
      if (p.imageUrl && p.imageUrl.startsWith('http')) {
        imageUrls.set(p.imageUrl, { name: `${p.name}_${p.id}`, folder: 'persons' });
      }
    });

    parties.forEach(p => {
      if (p.logoUrl && p.logoUrl.startsWith('http')) {
        imageUrls.set(p.logoUrl, { name: `${p.abbreviation}_logo`, folder: 'parties' });
      }
      if (p.flagUrl && p.flagUrl.startsWith('http')) {
        imageUrls.set(p.flagUrl, { name: `${p.abbreviation}_flag`, folder: 'parties' });
      }
    });

    alliances.forEach(a => {
      if (a.logoUrl && a.logoUrl.startsWith('http')) {
        imageUrls.set(a.logoUrl, { name: `${a.abbreviation}_logo`, folder: 'alliances' });
      }
    });

    assemblies.forEach(a => {
      if (a.logoUrl && a.logoUrl.startsWith('http')) {
        imageUrls.set(a.logoUrl, { name: `${a.name}_logo`, folder: 'assemblies' });
      }
    });

    constituencies.forEach(c => {
      if (c.imageUrl && c.imageUrl.startsWith('http')) {
        imageUrls.set(c.imageUrl, { name: `${c.name}_map`, folder: 'constituencies' });
      }
    });

    const uniqueUrls = Array.from(imageUrls.entries());
    setDownloadProgress({ current: 0, total: uniqueUrls.length });

    const fetchImage = async (url: string, info: { name: string; folder: string }, index: number) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const extension = blob.type.split('/')[1] || 'png';
        const fileName = `${info.folder}/${info.name}.${extension}`;
        zip.file(fileName, blob);
      } catch (err) {
        console.warn(`Failed to fetch image: ${url}`, err);
      } finally {
        setDownloadProgress(prev => ({ ...prev, current: index + 1 }));
      }
    };

    // Fetch in batches of 5 to avoid overloading
    const batchSize = 5;
    for (let i = 0; i < uniqueUrls.length; i += batchSize) {
      const batch = uniqueUrls.slice(i, i + batchSize);
      await Promise.all(batch.map(([url, info], index) => fetchImage(url, info, i + index)));
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `assembly_manager_images_${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setIsDownloading(false);
    setDownloadProgress({ current: 0, total: 0 });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <header className="flex items-center gap-4 mb-10">
        <div className="p-3 bg-[#FFD700]/10 rounded-2xl border border-[#FFD700]/20">
          <SettingsIcon className="text-[#FFD700]" size={32} />
        </div>
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter gold-text">System Settings</h1>
          <p className="text-gray-500 uppercase tracking-[0.2em] text-xs font-bold mt-1">Global Configuration & Data Management</p>
        </div>
      </header>

      {/* Data Management Section */}
      <section className="glass-card p-8 border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Download size={120} />
        </div>
        <h2 className="text-xl font-black uppercase tracking-widest text-white mb-2 flex items-center gap-2">
          <Download className="text-[#FFD700]" size={20} />
          Data Export
        </h2>
        <p className="text-gray-400 text-sm mb-8 max-w-2xl leading-relaxed">
          Retrieve all visual assets stored in the registry. This includes politician portraits, party symbols, alliance logos, and constituency maps. The assets will be packaged into a single ZIP archive for offline use.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={handleDownloadImages}
            disabled={isDownloading || persons.length === 0}
            className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3 ${
              isDownloading 
                ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10' 
                : 'bg-[#FFD700] text-black hover:scale-105 active:scale-95 shadow-xl shadow-[#FFD700]/20 cursor-pointer'
            }`}
          >
            {isDownloading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing {downloadProgress.current}/{downloadProgress.total}
              </>
            ) : (
              <>
                <Download size={18} />
                Download All Images
              </>
            )}
          </button>
          {persons.length === 0 && !isDownloading && (
            <p className="text-xs text-gray-600 uppercase tracking-widest font-bold">No images found in database</p>
          )}
        </div>
      </section>

      {/* Danger Zone Section */}
      <section className="glass-card p-8 border-red-500/10 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Trash2 size={120} />
        </div>
        
        <h2 className="text-xl font-black uppercase tracking-widest text-red-500 mb-2 flex items-center gap-2">
          <ShieldAlert size={20} />
          Danger Zone
        </h2>
        <p className="text-gray-400 text-sm mb-8 max-w-2xl leading-relaxed">
          Performing a factory reset will permanently erase all data associated with your account, including all persons, parties, assemblies, and legislative orders. This action is <span className="text-red-500 font-bold uppercase tracking-widest text-[10px]">irreversible</span> and will immediately purge the database.
        </p>

        <button
          onClick={handleOpenClearModal}
          className="px-8 py-4 rounded-2xl bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3 shadow-lg shadow-red-500/10 cursor-pointer"
        >
          <Trash2 size={18} />
          Wipe Registry Database
        </button>
      </section>

      {/* Clear Confirmation Modal */}
      <AnimatePresence>
        {showClearModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isClearing && setShowClearModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md glass-card relative overflow-hidden bg-[#0a0a0a] border border-red-500/30 rounded-3xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-500/10 rounded-2xl">
                      <ShieldAlert className="text-red-500" size={28} />
                    </div>
                    <div>
                      <h3 className="font-black uppercase tracking-tighter text-red-500 text-lg">Confirm Purge</h3>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Verification Required</p>
                    </div>
                  </div>
                  {!isClearing && (
                    <button onClick={() => setShowClearModal(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400">
                      <X size={20} />
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                    <p className="text-xs text-red-400 leading-relaxed font-medium">
                      You are about to initiate a full database wipe. All records will be permanently deleted. There is no "Undo" for this operation.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-black">Verification Code</p>
                      <div className="text-3xl font-black text-white tracking-[0.5em] font-mono bg-white/5 py-4 rounded-2xl border border-white/5">
                        {captchaValue}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Type the code above to confirm</label>
                      <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Enter 6-digit code"
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-red-500/40 text-white font-black text-center tracking-[0.2em]"
                        autoFocus
                      />
                    </div>

                    {clearError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-xs font-bold animate-shake">
                        <AlertCircle size={14} />
                        {clearError}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 pt-4">
                      <button
                        onClick={handleClearData}
                        disabled={isClearing || userInput.length !== 6}
                        className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 ${
                          isClearing || userInput.length !== 6
                            ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                            : 'bg-red-600 text-white shadow-xl shadow-red-600/30 hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                      >
                        {isClearing ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Purging Database...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={18} />
                            Verify & Execute Wipe
                          </>
                        )}
                      </button>
                      
                      {!isClearing && (
                        <button
                          onClick={() => setShowClearModal(false)}
                          className="w-full py-4 text-gray-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
                        >
                          Abort Operation
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
