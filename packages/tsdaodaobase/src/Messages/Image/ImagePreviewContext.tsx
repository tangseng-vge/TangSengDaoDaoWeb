import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { ImagePreviewManager, ImagePreviewState } from './ImagePreviewManager';

interface ImagePreviewContextType {
  previewState: ImagePreviewState;
  channelId: string;
}

// 创建一个全局Context
const ImagePreviewContext = createContext<ImagePreviewContextType>({
  previewState: {
    images: [],
    activeIndex: 0
  },
  channelId: ''
});

// 使用React Context API包装全局状态
export const ImagePreviewProvider: React.FC<{channelId: string, children: React.ReactNode}> = ({ channelId, children }) => {
  const [previewState, setPreviewState] = useState<ImagePreviewState>({
    images: [],
    activeIndex: 0,
  });

  useEffect(() => {
    // 订阅状态变化
    const unsubscribe = ImagePreviewManager.getInstance().subscribe(channelId, (newState) => {
      setPreviewState(newState);
    });

    // 清理函数
    return () => {
      unsubscribe();
    };
  }, [channelId]); // 仅在channelId变化时重新订阅

  const contextValue = useMemo(() => ({
    previewState,
    channelId
  }), [previewState, channelId]);

  return (
    <ImagePreviewContext.Provider value={contextValue}>
      {children}
    </ImagePreviewContext.Provider>
  );
};

export const useImagePreview = (): ImagePreviewContextType => {
  const context = useContext(ImagePreviewContext);
  if (!context) {
    throw new Error('useImagePreview must be used within an ImagePreviewProvider');
  }
  return context;
}; 