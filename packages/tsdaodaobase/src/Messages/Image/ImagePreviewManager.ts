import WKApp from "../../App";
import { Handler } from "mitt";

export interface PreviewImage {
  src: string;
  alt?: string;
  downloadUrl?: string;
}

export interface ImagePreviewState {
  images: PreviewImage[];
  activeIndex: number;
}

export type ImagePreviewSubscriber = (state: ImagePreviewState) => void;

export interface ImagePreviewStateWithSubscribe extends ImagePreviewState {
  subscribe: (callback: ImagePreviewSubscriber) => () => void;
}

// 定义事件数据类型
interface ImagePreviewClickEvent {
  channelId: string;
  imageUrl: string;
}

// 用于缓存从URL中提取的文件名
const fileNameCache = new Map<string, string>();

class ChannelImageManager {
  private subscribers: Set<ImagePreviewSubscriber> = new Set();
  private state: ImagePreviewState;
  private lastUpdateTime: number = 0;
  private subscriberIds: Map<ImagePreviewSubscriber, string> = new Map(); // 跟踪订阅者ID

  constructor(initialState: ImagePreviewState) {
    this.state = initialState;
  }

  getRawState(): ImagePreviewState {
    return this.state;
  }

  getState(): ImagePreviewStateWithSubscribe {
    return {
      ...this.state,
      subscribe: (callback: ImagePreviewSubscriber) => {
        const subscriberId = Math.random().toString(36).substring(2, 9);
        this.subscribers.add(callback);
        this.subscriberIds.set(callback, subscriberId);
        
        return () => {
          this.subscribers.delete(callback);
          this.subscriberIds.delete(callback);
        };
      },
    };
  }

  setState(newState: ImagePreviewState) {
    // 防止短时间内重复更新相同状态
    const now = Date.now();
    if (now - this.lastUpdateTime < 100 && 
        this.state.activeIndex === newState.activeIndex && 
        this.state.images.length === newState.images.length) {
      return;
    }
    
    this.lastUpdateTime = now;
    this.state = newState;
    this.notifySubscribers();
  }

  subscribe(callback: ImagePreviewSubscriber) {
    const subscriberId = Math.random().toString(36).substring(2, 9);
    this.subscribers.add(callback);
    this.subscriberIds.set(callback, subscriberId);
    
    // 立即以当前状态调用回调
    callback(this.state);

    return () => {
      this.subscribers.delete(callback);
      const id = this.subscriberIds.get(callback);
      this.subscriberIds.delete(callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach((callback) => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('ImagePreviewManager: Error notifying subscriber:', error);
      }
    });
  }
  
  // 清理所有订阅者
  clearSubscribers() {
    this.subscribers.clear();
    this.subscriberIds.clear();
  }
}

export class ImagePreviewManager {
  private static instance: ImagePreviewManager;
  private channelManagers: Map<string, ChannelImageManager> = new Map();
  private subscriberCount: number = 0;
  private refreshDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
  // 缓存URL到索引的映射，避免重复查找
  private urlToIndexCache: Map<string, Map<string, number>> = new Map();
  // 记录最后一次更新的时间戳，用于防止短时间内重复更新
  private lastUpdateTimes: Map<string, number> = new Map();
  // 记录每个频道的处理状态，防止并发处理
  private processingChannels: Set<string> = new Set();
  // 跟踪每个频道的订阅者数量
  private channelSubscriberCounts: Map<string, number> = new Map();
  // 全局订阅ID计数器
  private subscriberIdCounter: number = 0;
  // 跟踪所有订阅者的引用
  private allSubscribers: Map<string, { channelId: string, callback: ImagePreviewSubscriber }> = new Map();

  static getInstance(): ImagePreviewManager {
    if (!ImagePreviewManager.instance) {
      ImagePreviewManager.instance = new ImagePreviewManager();
      console.log("ImagePreviewManager: Initialized");
      
      // 监听图片点击事件
      WKApp.mittBus.on("image-preview-click", ((event) => {
        const data = event as {channelId: string, imageUrl: string};
        ImagePreviewManager.instance.updateActiveIndex(data.channelId, data.imageUrl);
      }) as Handler<unknown>);
    }
    return ImagePreviewManager.instance;
  }

  private constructor() {
    // 监听图片列表变化事件
    WKApp.mittBus.on("images-list-changed", ((event) => {
      const channelId = event as string;
      
      // 如果该频道正在处理中，则跳过
      if (this.processingChannels.has(channelId)) {
        return;
      }
      
      // 检查最后更新时间，避免频繁刷新
      const now = Date.now();
      const lastUpdateTime = this.lastUpdateTimes.get(channelId) || 0;
      if (now - lastUpdateTime < 300) { // 300ms内不重复处理同一频道
        return;
      }
      
      // 清除URL缓存
      this.urlToIndexCache.delete(channelId);
      
      // 防抖刷新
      if (this.refreshDebounceTimers.has(channelId)) {
        clearTimeout(this.refreshDebounceTimers.get(channelId)!);
      }
      
      this.refreshDebounceTimers.set(
        channelId,
        setTimeout(() => {
          this.processingChannels.add(channelId);
          try {
            this.refreshChannelImages(channelId);
            this.lastUpdateTimes.set(channelId, Date.now());
          } finally {
            this.processingChannels.delete(channelId);
            this.refreshDebounceTimers.delete(channelId);
          }
        }, 200)
      );
    }) as Handler<unknown>);
    
    // 定期清理未使用的频道资源
    setInterval(() => {
      this.cleanupUnusedResources();
    }, 60000); // 每分钟检查一次
  }
  
  // 清理未使用的频道资源
  private cleanupUnusedResources() {
    const unusedChannels: string[] = [];
    
    this.channelSubscriberCounts.forEach((count, channelId) => {
      if (count <= 0) {
        unusedChannels.push(channelId);
      }
    });
    
    if (unusedChannels.length > 0) {
      console.log(`ImagePreviewManager: Cleaning up resources for ${unusedChannels.length} unused channel(s).`);
      
      unusedChannels.forEach(channelId => {
        this.clearChannelCache(channelId);
      });
    }
  }

  private updateActiveIndex(channelId: string, imageUrl: string) {
    // 如果该频道正在处理中，则跳过
    if (this.processingChannels.has(channelId)) {
      return;
    }
    
    this.processingChannels.add(channelId);
    try {
      // 获取频道图片
      const channelImages = WKApp.showImages.getImagesByChannel(channelId);
      if (!channelImages || channelImages.length === 0) {
        return;
      }

      // 从URL中提取文件名进行比较
      const clickedFileName = this.getFileNameFromURL(imageUrl);
      
      // 检查缓存
      let urlCache = this.urlToIndexCache.get(channelId);
      if (!urlCache) {
        urlCache = new Map<string, number>();
        this.urlToIndexCache.set(channelId, urlCache);
        
        // 预填充缓存
        channelImages.forEach((img, index) => {
          const fileName = this.getFileNameFromURL(img.url);
          urlCache!.set(fileName, index);
        });
      }
      
      // 从缓存中查找索引
      const cachedIndex = urlCache.get(clickedFileName);
      if (cachedIndex !== undefined) {
        this.updateChannelManagerActiveIndex(channelId, cachedIndex);
        return;
      }
      
      // 缓存未命中，执行一次性查找
      for (let i = 0; i < channelImages.length; i++) {
        const imgFileName = this.getFileNameFromURL(channelImages[i].url);
        urlCache.set(imgFileName, i);
        
        if (imgFileName === clickedFileName) {
          this.updateChannelManagerActiveIndex(channelId, i);
          return;
        }
      }
      
    } finally {
      this.processingChannels.delete(channelId);
    }
  }
  
  private updateChannelManagerActiveIndex(channelId: string, index: number) {
    const manager = this.getOrCreateChannelManager(channelId);
    const currentState = manager.getState();
    
    // 避免重复更新相同索引
    if (currentState.activeIndex === index) {
      return;
    }
    
    manager.setState({
      ...currentState,
      activeIndex: index
    });
  }

  private getFileNameFromURL(url: string): string {
    // 检查缓存
    if (fileNameCache.has(url)) {
      return fileNameCache.get(url)!;
    }
    
    const fileName = url.split('/').pop()?.split('?')[0] || '';
    // 如果文件名包含特定格式的哈希值，则提取哈希值部分
    const hashMatch = fileName.match(/([A-F0-9]{32})/);
    const result = hashMatch ? hashMatch[1] : fileName;
    
    // 缓存结果
    fileNameCache.set(url, result);
    return result;
  }

  private normalizeImageURL(url: string): string {
    // 提取文件名或哈希部分，忽略查询参数
    return this.getFileNameFromURL(url);
  }

  refreshChannelImages(channelId: string) {
    if (!channelId) {
      return;
    }
    
    // 清除URL缓存
    this.urlToIndexCache.delete(channelId);
    
    const manager = this.channelManagers.get(channelId);
    if (manager) {
      this.updateChannelImages(channelId);
    }
  }

  private updateChannelImages(channelId: string) {
    const channelImages = WKApp.showImages.getImagesByChannel(channelId);
    
    if (!channelImages || channelImages.length === 0) {
      return;
    }
    
    const previewImages: PreviewImage[] = channelImages.map((img) => {
      const downloadURL = WKApp.dataSource.commonDataSource.getImageURL(img.url);
      return {
        src: downloadURL,
        alt: '',
        downloadUrl: downloadURL,
      };
    });
    
    const manager = this.getOrCreateChannelManager(channelId);
    const currentState = manager.getState();
    
    // 比较图片内容是否发生实质性变化
    let hasChanged = currentState.images.length !== previewImages.length;
    
    if (!hasChanged && previewImages.length > 0) {
      // 检查图片URL是否有变化
      for (let i = 0; i < previewImages.length; i++) {
        if (i >= currentState.images.length || 
            this.normalizeImageURL(previewImages[i].src) !== 
            this.normalizeImageURL(currentState.images[i].src)) {
          hasChanged = true;
          break;
        }
      }
    }
    
    // 只有在图片数量或内容发生变化时才更新状态
    if (hasChanged) {
      manager.setState({
        images: previewImages,
        activeIndex: Math.min(currentState.activeIndex, previewImages.length - 1)
      });
    }
  }

  getPreviewState(channelId: string, currentImageURL?: string): ImagePreviewState {
    const manager = this.getOrCreateChannelManager(channelId);
    const state = manager.getRawState();
    
    // 如果提供了当前图片URL，更新激活索引
    if (currentImageURL) {
      this.updateActiveIndex(channelId, currentImageURL);
    }
    
    return state;
  }
  
  private getOrCreateChannelManager(channelId: string): ChannelImageManager {
    let manager = this.channelManagers.get(channelId);
    
    if (!manager) {
      console.log(`ImagePreviewManager: Creating new ChannelImageManager for channel ${channelId}`);
      
      manager = new ChannelImageManager({
        images: [],
        activeIndex: 0
      });
      
      this.channelManagers.set(channelId, manager);
      this.updateChannelImages(channelId);
    }
    
    return manager;
  }

  subscribe(channelId: string, callback: (state: ImagePreviewState) => void) {
    // 生成唯一的订阅者ID
    this.subscriberIdCounter++;
    const subscriberId = `sub_${this.subscriberIdCounter}_${Math.random().toString(36).substring(2, 9)}`;
    
    
    // 存储订阅者引用
    this.allSubscribers.set(subscriberId, {
      channelId,
      callback
    });
    
    const manager = this.getOrCreateChannelManager(channelId);
    
    // 增加频道订阅计数
    const channelCount = this.channelSubscriberCounts.get(channelId) || 0;
    this.channelSubscriberCounts.set(channelId, channelCount + 1);
    
    this.subscriberCount++;
    
    const unsubscribe = manager.subscribe(callback);
    
    // 返回增强版的取消订阅函数
    return () => {
      
      // 移除订阅者引用
      this.allSubscribers.delete(subscriberId);
      
      // 执行原始的取消订阅
      unsubscribe();
      
      // 减少频道订阅计数
      const currentChannelCount = this.channelSubscriberCounts.get(channelId) || 0;
      if (currentChannelCount <= 1) {
        this.channelSubscriberCounts.delete(channelId);
      } else {
        this.channelSubscriberCounts.set(channelId, currentChannelCount - 1);
      }
      
      this.subscriberCount--;
      
      // 如果频道没有订阅者了，清理资源
      if ((this.channelSubscriberCounts.get(channelId) || 0) <= 0) {
        // 延迟清理，避免频繁的订阅/取消订阅操作导致资源反复创建和销毁
        setTimeout(() => {
          if ((this.channelSubscriberCounts.get(channelId) || 0) <= 0) {
            this.clearChannelCache(channelId);
          }
        }, 5000);
      }
    };
  }

  clearChannelCache(channelId: string) {
    console.log(`ImagePreviewManager: Clearing cache for channel ${channelId}.`);
    
    const manager = this.channelManagers.get(channelId);
    if (manager) {
      // 清理该频道的所有订阅者
      manager.clearSubscribers();
    }
    
    this.channelManagers.delete(channelId);
    this.urlToIndexCache.delete(channelId);
    this.lastUpdateTimes.delete(channelId);
    this.channelSubscriberCounts.delete(channelId);
    
    // 移除所有与该频道相关的订阅者引用
    const subscribersToRemove: string[] = [];
    this.allSubscribers.forEach((data, id) => {
      if (data.channelId === channelId) {
        subscribersToRemove.push(id);
      }
    });
    
    subscribersToRemove.forEach(id => {
      this.allSubscribers.delete(id);
    });
    
    
    // 不要在这里调用 WKApp.showImages.clearChannelImages(channelId)
    // 因为这会触发 images-list-changed 事件，可能导致循环
  }
  
  // 提供一个方法来获取当前订阅状态
  getSubscriberStats() {
    const stats = {
      totalSubscribers: this.subscriberCount,
      channelCounts: Object.fromEntries(this.channelSubscriberCounts),
      channelManagers: Array.from(this.channelManagers.keys()),
      subscriberRefs: this.allSubscribers.size
    };
    return stats;
  }
}

export default ImagePreviewManager; 