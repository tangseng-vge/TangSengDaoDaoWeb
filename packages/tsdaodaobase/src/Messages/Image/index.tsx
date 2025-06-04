import { MediaMessageContent } from "wukongimjssdk";
import React from "react";
import WKApp from "../../App";
import { MessageContentTypeConst } from "../../Service/Const";
import MessageBase from "../Base";
import { MessageCell } from "../MessageCell";
import Viewer from "react-viewer";
import {ImageDecorator} from "react-viewer/lib/ViewerProps";

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
  // 可能还有其他属性，根据实际情况添加
}

interface ImageCellState {
  showPreview: boolean
}


export class ImageCell extends MessageCell<any, Omit<ImageCellState, 'imagess' | 'activeIndex'>>
{

  private imagess:ImageItem[]= [];
  private activeIndex: number = 0;

  constructor(props: any) {
    super(props);
    this.state = {
      showPreview: false,
    };
  }

  initializeImageData(imageURL :string) {

    // 使用 const 替代 var，并进行空值检查
    const storageItemForImages = WKApp.showImages.getStorageItemForImages() || [];

// 单次循环同时构建数组和查找索引，避免两次遍历
    const fullUrlArrays: Array<{ src: string; alt: string; downloadUrl: string }> = [];
    console.log(JSON.stringify(storageItemForImages))
    if (Array.isArray(storageItemForImages)) {
      for (let i = 0; i < storageItemForImages.length; i++) {
        const fullUrl = this.getImageSrc(storageItemForImages[i]) || "";
        fullUrlArrays.push({ src: fullUrl, alt: "", downloadUrl: fullUrl });

        // 在同一循环中查找匹配的图片索引
        if (imageURL === fullUrl) {
          this.activeIndex = i;
        }
      }
    }


    // 只调用一次 setState，传入所有更新的状态
    if (fullUrlArrays.length > 0) {
      // 使用 setTimeout 将 setState 推迟到下一个事件循环
      this.imagess = fullUrlArrays
    }
    console.log(JSON.stringify(this.imagess))

  }


  imageScale(
    orgWidth: number,
    orgHeight: number,
    maxWidth = 250,
    maxHeight = 250
  ) {
    let actSize = { width: orgWidth, height: orgHeight };
    if (orgWidth > orgHeight) {
      //横图
      if (orgWidth > maxWidth) {
        // 横图超过最大宽度
        let rate = maxWidth / orgWidth; // 缩放比例
        actSize.width = maxWidth;
        actSize.height = orgHeight * rate;
      }
    } else if (orgWidth < orgHeight) {
      //竖图
      if (orgHeight > maxHeight) {
        let rate = maxHeight / orgHeight; // 缩放比例
        actSize.width = orgWidth * rate;
        actSize.height = maxHeight;
      }
    } else if (orgWidth === orgHeight) {
      if (orgWidth > maxWidth) {
        let rate = maxWidth / orgWidth; // 缩放比例
        actSize.width = maxWidth;
        actSize.height = orgHeight * rate;
      }
    }
    return actSize;
  }

  getImageSrc(content: ImageContent) {
    if (content.url && content.url !== "") {
      // 等待发送的消息
      let downloadURL = WKApp.dataSource.commonDataSource.getImageURL(
        content.url,
        { width: content.width, height: content.height }
      );
      if (downloadURL.indexOf("?") != -1) {
        downloadURL += "&filename=image.png";
      } else {
        downloadURL += "?filename=image.png";
      }
      return downloadURL;
    }
    return content.imgData;
  }

  getImageElement() {
    const { message } = this.props;
    const content = message.content as ImageContent;
    let scaleSize = this.imageScale(content.width, content.height);
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

  render() {
    const { message, context } = this.props;
    const { showPreview} = this.state;
    const content = message.content as ImageContent;
    let scaleSize = this.imageScale(content.width, content.height);
    const imageURL = this.getImageSrc(content) || "";
    if (showPreview) {
      this.initializeImageData(imageURL);
    }
    return (
      <MessageBase context={context} message={message}>
        <div
          style={{
            width: scaleSize.width,
            height: scaleSize.height,
            cursor: "pointer",
          }}
          onClick={() => this.setState({showPreview: !this.state.showPreview})}
        >
          {this.getImageElement()}
        </div>
        <Viewer visible={showPreview} activeIndex={this.activeIndex} noImgDetails={true} downloadable={true}
                rotatable={false} changeable={true} showTotal={false}
                onChange={(activeImage: ImageDecorator, index: number) => {}}
                onMaskClick={() => this.setState({showPreview: false})}
                onClose={() => this.setState({showPreview: false})} images={this.imagess||[]}/>
      </MessageBase>
    );
  }
}
