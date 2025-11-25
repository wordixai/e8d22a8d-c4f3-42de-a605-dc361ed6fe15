import { useState, useRef, useEffect } from 'react';
import { Download, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import html2canvas from 'html2canvas';

interface Photo {
  id: string;
  imageData: string;
  date: string;
  caption: string;
  position: { x: number; y: number };
  isDragging: boolean;
  isOnWall: boolean;
  opacity: number;
}

const Index = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isEjecting, setIsEjecting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const playShutterSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 400;
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  const generateCaption = async (imageData: string): Promise<string> => {
    const language = navigator.language || 'en';
    
    const captions: { [key: string]: string[] } = {
      'zh': ['美好的瞬间', '珍贵的回忆', '温馨时光', '快乐时刻', '难忘的一天'],
      'en': ['Beautiful moment', 'Precious memory', 'Sweet time', 'Happy moment', 'Unforgettable day'],
      'ja': ['素敵な瞬間', '大切な思い出', '幸せな時間', '楽しい瞬間', '忘れられない日'],
      'es': ['Momento hermoso', 'Recuerdo precioso', 'Tiempo dulce', 'Momento feliz', 'Día inolvidable'],
      'fr': ['Beau moment', 'Souvenir précieux', 'Moment doux', 'Instant joyeux', 'Jour inoubliable']
    };

    const langCode = language.split('-')[0];
    const messages = captions[langCode] || captions['en'];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const capturePhoto = async () => {
    if (!videoRef.current || isEjecting) return;

    playShutterSound();
    setIsEjecting(true);

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    
    const aspectRatio = 3 / 4;
    const width = 300;
    const height = width / aspectRatio;
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      
      const caption = await generateCaption(imageData);
      const now = new Date();
      const dateStr = now.toLocaleDateString();

      const newPhoto: Photo = {
        id: Date.now().toString(),
        imageData,
        date: dateStr,
        caption,
        position: { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 200 },
        isDragging: false,
        isOnWall: false,
        opacity: 0
      };

      setPhotos(prev => [...prev, newPhoto]);

      setTimeout(() => {
        setPhotos(prev => prev.map(p => 
          p.id === newPhoto.id ? { ...p, opacity: 1 } : p
        ));
      }, 100);

      setTimeout(() => {
        setIsEjecting(false);
      }, 2000);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top
    };

    setPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, isDragging: true, isOnWall: true } : p
    ));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const draggingPhoto = photos.find(p => p.isDragging);
    if (!draggingPhoto || !dragRef.current) return;

    const x = e.clientX - dragRef.current.offsetX;
    const y = e.clientY - dragRef.current.offsetY;

    setPhotos(prev => prev.map(p => 
      p.id === draggingPhoto.id ? { ...p, position: { x, y } } : p
    ));
  };

  const handleMouseUp = () => {
    setPhotos(prev => prev.map(p => ({ ...p, isDragging: false })));
    dragRef.current = null;
  };

  const deletePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const downloadPhoto = async (photoId: string) => {
    const photoElement = document.getElementById(`photo-${photoId}`);
    if (!photoElement) return;

    const canvas = await html2canvas(photoElement, {
      backgroundColor: '#ffffff',
      scale: 2
    });

    const link = document.createElement('a');
    link.download = `retro-photo-${photoId}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const startEditing = (photoId: string, currentCaption: string) => {
    setEditingId(photoId);
    setEditText(currentCaption);
  };

  const saveEdit = (photoId: string) => {
    setPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, caption: editText } : p
    ));
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const regenerateCaption = async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    const newCaption = await generateCaption(photo.imageData);
    setPhotos(prev => prev.map(p => 
      p.id === photoId ? { ...p, caption: newCaption } : p
    ));
  };

  return (
    <div 
      className="fixed inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-red-50"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-10">
        <h1 className="text-6xl font-bold text-amber-900">Bao Retro Camera</h1>
      </div>

      <div className="fixed bottom-8 right-8 z-10 text-right">
        <div className="text-lg text-amber-800 space-y-1">
          <p>📸 Click the button to take a photo</p>
          <p>✋ Drag photos to arrange them</p>
          <p>✏️ Double-click text to edit</p>
        </div>
      </div>

      <div 
        className="fixed bg-no-repeat bg-contain"
        style={{
          bottom: '64px',
          left: '64px',
          width: '450px',
          height: '450px',
          backgroundImage: 'url(https://s.baoyu.io/images/retro-camera.webp)',
          zIndex: 20
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute object-cover"
          style={{
            bottom: '32%',
            left: '62%',
            transform: 'translateX(-50%)',
            width: '27%',
            height: '27%',
            borderRadius: '50%',
            zIndex: 30
          }}
        />

        <button
          onClick={capturePhoto}
          disabled={isEjecting}
          className="absolute cursor-pointer"
          style={{
            bottom: '40%',
            left: '18%',
            width: '11%',
            height: '11%',
            zIndex: 30,
            background: 'transparent',
            border: 'none'
          }}
        />

        {photos.map(photo => {
          if (photo.isOnWall) return null;
          
          return (
            <div
              key={photo.id}
              className="absolute transition-all duration-1000"
              style={{
                transform: 'translateX(-50%)',
                top: 0,
                left: '50%',
                width: '35%',
                height: '100%',
                zIndex: 10,
                animation: isEjecting && photos[photos.length - 1].id === photo.id 
                  ? 'ejectPhoto 2s ease-out forwards' 
                  : 'none'
              }}
            >
              <style>{`
                @keyframes ejectPhoto {
                  0% { transform: translateX(-50%) translateY(0); }
                  100% { transform: translateX(-50%) translateY(-40%); }
                }
              `}</style>
              <div
                id={`photo-${photo.id}`}
                className="bg-white p-4 shadow-2xl cursor-move"
                style={{
                  aspectRatio: '3/4',
                  opacity: photo.opacity,
                  transition: 'opacity 3s ease-in'
                }}
                onMouseDown={(e) => handleMouseDown(e, photo.id)}
              >
                <div 
                  className="w-full bg-gray-200 mb-3"
                  style={{
                    aspectRatio: '3/4',
                    filter: photo.opacity < 1 ? `blur(${(1 - photo.opacity) * 10}px)` : 'none',
                    transition: 'filter 3s ease-in'
                  }}
                >
                  <img 
                    src={photo.imageData} 
                    alt="Captured moment" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm text-gray-600">{photo.date}</p>
                  {editingId === photo.id ? (
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(photo.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      onBlur={() => saveEdit(photo.id)}
                      autoFocus
                      className="w-full text-center text-lg font-medium border-b-2 border-amber-400 bg-transparent outline-none"
                    />
                  ) : (
                    <p 
                      className="text-lg font-medium group/text relative"
                      onDoubleClick={() => startEditing(photo.id, photo.caption)}
                    >
                      {photo.caption}
                      <span className="absolute -top-6 right-0 opacity-0 group-hover/text:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={() => startEditing(photo.id, photo.caption)}
                          className="p-1 hover:bg-amber-100 rounded"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => regenerateCaption(photo.id)}
                          className="p-1 hover:bg-amber-100 rounded"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {photos.filter(p => p.isOnWall).map(photo => (
        <div
          key={photo.id}
          id={`photo-${photo.id}`}
          className="fixed bg-white p-4 shadow-2xl cursor-move group/card"
          style={{
            left: `${photo.position.x}px`,
            top: `${photo.position.y}px`,
            width: '300px',
            zIndex: photo.isDragging ? 100 : 50
          }}
          onMouseDown={(e) => handleMouseDown(e, photo.id)}
        >
          <div className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity flex gap-1 z-10">
            <button
              onClick={() => downloadPhoto(photo.id)}
              className="p-2 bg-white hover:bg-amber-100 rounded shadow-lg"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => deletePhoto(photo.id)}
              className="p-2 bg-white hover:bg-red-100 rounded shadow-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div 
            className="w-full bg-gray-200 mb-3"
            style={{ aspectRatio: '3/4' }}
          >
            <img 
              src={photo.imageData} 
              alt="Captured moment" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm text-gray-600">{photo.date}</p>
            {editingId === photo.id ? (
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit(photo.id);
                  if (e.key === 'Escape') cancelEdit();
                }}
                onBlur={() => saveEdit(photo.id)}
                autoFocus
                className="w-full text-center text-lg font-medium border-b-2 border-amber-400 bg-transparent outline-none"
              />
            ) : (
              <p 
                className="text-lg font-medium group/text relative"
                onDoubleClick={() => startEditing(photo.id, photo.caption)}
              >
                {photo.caption}
                <span className="absolute -top-6 right-0 opacity-0 group-hover/text:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={() => startEditing(photo.id, photo.caption)}
                    className="p-1 hover:bg-amber-100 rounded"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => regenerateCaption(photo.id)}
                    className="p-1 hover:bg-amber-100 rounded"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </span>
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Index;