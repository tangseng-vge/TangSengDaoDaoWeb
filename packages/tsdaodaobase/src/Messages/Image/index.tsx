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
      console.log("组件挂载时初始化图片数据");
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
      console.log("检测到图片列表变化，重新初始化图片数据");
      const content = message.content as ImageContent;
      const imageURL = this.getImageSrc(content);
      if (imageURL) {
        this.initializeImageData(imageURL);
      }
    }
  }

  // 初始化图片数据
  initializeImageData(imageURL: string) {
    const channelId = this.props.message.channel.channelID;
    const messageSeq = this.props.message.messageSeq;

    // 获取频道所有图片
    const channelImages = WKApp.showImages.getImagesByChannel(channelId);

    if (!channelImages || channelImages.length === 0) {
      // 如果没有图片，只添加当前图片
      this.setState({
        images: [{
          src: imageURL,
          alt: "",
          downloadUrl: imageURL
        }],
        activeIndex: 0
      });
      return;
    }

    // 按照 messageSeq 排序
    channelImages.sort((a, b) => (a.messageSeq || 0) - (b.messageSeq || 0));

    // 提取当前图片的文件名
    const currentFileName = this.getFileNameFromURL(imageURL);

    // 转换为预览格式
    const images = channelImages.map(item => ({
      src: this.getImageSrc(item),
      alt: "",
      downloadUrl: this.getImageSrc(item)
    }));

    // 查找当前图片索引
    let activeIndex = 0;
    for (let i = 0; i < channelImages.length; i++) {
      const itemFileName = this.getFileNameFromURL(channelImages[i].url);
      if (currentFileName === itemFileName) {
        activeIndex = i;
        break;
      }
    }

    this.setState({ images, activeIndex });
  }

  // 从 URL 中提取文件名
  getFileNameFromURL(url: string): string {
    const urlParts = url.split('/');
    return urlParts[urlParts.length - 1].split('?')[0];
  }

  // 获取图片 URL
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

  // 计算图片显示尺寸
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

  // 获取图片元素
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

  // 处理预览状态变化
  handlePreviewChange = (activeImage: ImageDecorator, index: number) => {
    this.setState({ activeIndex: index });
  };

  // 处理图片点击
  handlePreview = () => {
    this.setState({ showPreview: true });
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
