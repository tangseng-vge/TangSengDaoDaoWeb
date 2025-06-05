import { MediaMessageContent } from "wukongimjssdk";
import React from "react";
import WKApp from "../../App";
import { MessageContentTypeConst } from "../../Service/Const";
import MessageBase from "../Base";
import { MessageCell } from "../MessageCell";
import Viewer from "react-viewer";
import {ImageDecorator} from "react-viewer/lib/ViewerProps";

// 声明 mitt 事件类型
declare module "mitt" {
  interface EventsMap {
    "images-list-changed": string;
  }
}

export class ImageContent extends MediaMessageContent {
  width!: number;
  height!: number;
  url!: string;
  imgData?: string;
  constructor(file?: File, imgData?: string, width?: number, height?: number) {
    super();
    this.file = file;
    this.imgData = imgData;
    this.width = width || 0;
    this.height = height || 0;
  }
  decodeJSON(content: any) {
    this.width = content["width"] || 0;
    this.height = content["height"] || 0;
    this.url = content["url"] || "";
    this.remoteUrl = this.url;
  }
  encodeJSON() {
    return {
      width: this.width || 0,
      height: this.height || 0,
      url: this.remoteUrl || "",
    };
  }
  get contentType() {
    return MessageContentTypeConst.image;
  }
  get conversationDigest() {
    return "[图片]";
  }
}
interface ImageItem {
  src: string;
  alt?: string;
  downloadUrl?: string;
}

interface ImageCellState {
  showPreview: boolean;
  images: ImageItem[];
  activeIndex: number;
}

export class ImageCell extends MessageCell<any, ImageCellState> {
  constructor(props: any) {
    super(props);
    this.state = {
      showPreview: false,
      images: [],
      activeIndex: 0
    };
  }

  componentDidMount() {
    const { message } = this.props;
    const content = message.content as ImageContent;
    const imageURL = this.getImageSrc(content);
    if (imageURL) {
      // console.log("组件挂载时初始化图片数据");
      this.initializeImageData(imageURL);

      // 添加图片列表变化监听
      WKApp.mittBus.on("images-list-changed", this.handleImagesListChanged as any);
    }
  }

  componentWillUnmount() {
    // 移除监听器
    WKApp.mittBus.off("images-list-changed", this.handleImagesListChanged as any);
  }

  // 处理图片列表变化
  handleImagesListChanged = (channelId: any) => {
    const { message } = this.props;
    if (message.channel.channelID === channelId) {
      // console.log("检测到图片列表变化，重新初始化图片数据");
      const content = message.content as ImageContent;
      const imageURL = this.getImageSrc(content);
      if (imageURL) {
        this.initializeImageData(imageURL);
      }
    }
  }

  initializeImageData(imageURL: string) {

    // console.error("!!!!!!!!!!!!!!重新初始化!!!!!!!!!!!!")
    const channelId = this.props.message.channel.channelID;
    const messageSeq = this.props.message.messageSeq;
    // console.log(`初始化图片数据，当前图片URL: ${imageURL}, 频道ID: ${channelId}, 消息序号: ${messageSeq}`);

    const storageItemForImages = WKApp.showImages.getImagesByChannel(channelId);
    // console.log(`从存储获取到 ${storageItemForImages.length} 张图片`);

    // console.log(" images Data" +JSON.stringify(storageItemForImages))

    const images: ImageItem[] = [];
    let activeIndex = 0;
    let foundCurrentImage = false;

    // 提取当前图片的文件名部分用于比较
    const currentUrlParts = imageURL.split('/');
    const currentFileName = currentUrlParts[currentUrlParts.length - 1].split('?')[0];
    // console.log(`当前图片文件名: ${currentFileName}`);

    if (Array.isArray(storageItemForImages) && storageItemForImages.length > 0) {
      // console.log("开始处理存储的图片列表");
      // 按照 messageSeq 排序，确保图片顺序正确  // 自己最后发的图片没有seqNo 默认添加到最后
      // storageItemForImages.sort((a, b) => (a.messageSeq || 0) - (b.messageSeq || 0));

      // 先获取当前图片的完整URL，用于比较
      // console.log(`当前图片完整URL: ${imageURL}`);

      storageItemForImages.forEach((item, index) => {
        if (item && item.url) {
          const fullUrl = this.getImageSrc(item);
          if (fullUrl) {
            // 提取存储图片的文件名部分
            const itemUrlParts = item.url.split('/');
            const itemFileName = itemUrlParts[itemUrlParts.length - 1].split('?')[0];

            // 添加图片到预览列表
            images.push({
              src: fullUrl,
              alt: "",
              downloadUrl: fullUrl
            });

            // 检查是否是当前图片
            if (!foundCurrentImage && currentFileName === itemFileName) {
              activeIndex = index;
              foundCurrentImage = true;
              // console.log(`找到当前图片在列表中的位置: ${index}, messageSeq: ${item.messageSeq}, 文件名: ${itemFileName}`);
            }
          }
        }
      });
      // console.log(`处理完成，共添加 ${images.length} 张图片到预览列表，当前图片${foundCurrentImage ? '已找到' : '未找到'}`);
    }

    // 如果当前图片不在列表中，将其添加到列表（仅在组件初始化时）
    // 注意：这里我们不再添加当前图片，因为这可能导致重复
    if (images.length === 0) {
      const currentImageUrl = this.getImageSrc({ url: imageURL });
      if (currentImageUrl) {
        // console.log(`没有图片列表，添加当前图片`);
        images.push({
          src: currentImageUrl,
          alt: "",
          downloadUrl: currentImageUrl
        });
        activeIndex = 0;
      }
    }

    // console.log(`设置状态: ${images.length} 张图片, 当前索引: ${activeIndex}`);

    this.setState({
      images: images,
      activeIndex: activeIndex
    });
  }

  getImageSrc(content: ImageContent | any) {
    if (content && content.url && content.url !== "") {
      let downloadURL = WKApp.dataSource.commonDataSource.getImageURL(
        content.url,
        { width: content.width, height: content.height }
      );
      downloadURL += downloadURL.includes("?") ? "&filename=image.png" : "?filename=image.png";
      return downloadURL;
    }
    return content && content.imgData ? content.imgData : undefined;
  }

  imageScale(
    orgWidth: number,
    orgHeight: number,
    maxWidth = 250,
    maxHeight = 250
  ) {
    const actSize = { width: orgWidth, height: orgHeight };
    const scaleByWidth = (width: number) => {
      const rate = width / orgWidth;
      actSize.width = width;
      actSize.height = orgHeight * rate;
    };

    if (orgWidth > orgHeight) {
      if (orgWidth > maxWidth) {
        scaleByWidth(maxWidth);
      }
    } else if (orgWidth < orgHeight) {
      if (orgHeight > maxHeight) {
        const rate = maxHeight / orgHeight;
        actSize.width = orgWidth * rate;
        actSize.height = maxHeight;
      }
    } else if (orgWidth > maxWidth) {
      scaleByWidth(maxWidth);
    }

    return actSize;
  }

  getImageElement() {
    const { message } = this.props;
    const content = message.content as ImageContent;
    const scaleSize = this.imageScale(content.width, content.height);

    return (
      <img
        alt=""
        src={this.getImageSrc(content)}
        style={{
          borderRadius: "5px",
          width: scaleSize.width,
          height: scaleSize.height,
        }}
      />
    );
  }

  handlePreview = () => {
    const { message } = this.props;
    const content = message.content as ImageContent;
    const imageURL = this.getImageSrc(content);

    // 提取当前图片的文件名部分用于比较
    const currentUrlParts = imageURL.split('/');
    const currentFileName = currentUrlParts[currentUrlParts.length - 1].split('?')[0];

    // 查找当前图片在列表中的索引
    const currentIndex = this.state.images.findIndex(img => {
      const itemUrlParts = img.src.split('/');
      const itemFileName = itemUrlParts[itemUrlParts.length - 1].split('?')[0];
      return currentFileName === itemFileName;
    });

    // console.log(`预览图片，文件名: ${currentFileName}, 找到索引: ${currentIndex}`);

    if (currentIndex !== -1) {
      this.setState({
        showPreview: true,
        activeIndex: currentIndex
      });
    } else {
      // console.log(`未找到当前图片在预览列表中的位置 ${imageURL?.length}，使用默认索引 ${this.state.images.length-1}   ${this.state.images[this.state.images.length-1]}`);
      this.setState({
        showPreview: true,
        activeIndex: this.state.images.length-1
      });
    }
  }

  handlePreviewChange = (activeImage: ImageDecorator, index: number) => {
    this.setState({ activeIndex: index });
  };

  closePreview = () => {
    this.setState({ showPreview: false });
  }

  render() {
    const { message, context } = this.props;
    const { showPreview, images, activeIndex } = this.state;
    const content = message.content as ImageContent;
    const scaleSize = this.imageScale(content.width, content.height);

    return (
      <MessageBase context={context} message={message}>
        <div
          style={{
            width: scaleSize.width,
            height: scaleSize.height,
            cursor: "pointer",
          }}
          onClick={this.handlePreview}
        >
          {this.getImageElement()}
        </div>
        {images.length > 0 && (
          <Viewer
            visible={showPreview}
            activeIndex={activeIndex}
            noImgDetails={true}
            downloadable={true}
            rotatable={false}
            changeable={true}
            showTotal={false}
            onChange={this.handlePreviewChange}
            onMaskClick={() => this.setState({ showPreview: false })}
            onClose={() => this.setState({ showPreview: false })}
            images={images}
          />
        )}
      </MessageBase>
    );
  }
}
