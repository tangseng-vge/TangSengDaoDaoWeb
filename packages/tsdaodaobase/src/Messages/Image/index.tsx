import { MediaMessageContent } from "wukongimjssdk";
import React, { useState } from "react";
import WKApp from "../../App";
import { MessageContentTypeConst } from "../../Service/Const";
import MessageBase from "../Base";
import { MessageBaseCellProps } from "../MessageCell";
import Viewer from "react-viewer";
import { useImagePreview } from "./ImagePreviewContext";

// 声明 mitt 事件类型
declare module "mitt" {
  interface Events {
    "images-list-changed": string;
    "image-preview-click": { channelId: string; messageSeq: number };
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

export const ImageCell: React.FC<MessageBaseCellProps> = (props) => {
  const { message, context } = props;
  const [showPreview, setShowPreview] = useState(false);
  const { previewState } = useImagePreview();
  const { images, activeIndex } = previewState;

  const content = message.content as ImageContent;

  const getImageSrc = (content: ImageContent | any) => {
    if (content && content.url && content.url !== "") {
      let downloadURL = WKApp.dataSource.commonDataSource.getImageURL(
        content.url,
        { width: content.width, height: content.height }
      );
      downloadURL += downloadURL.includes("?")
        ? "&filename=image.png"
        : "?filename=image.png";
      return downloadURL;
    }
    return content && content.imgData ? content.imgData : undefined;
  };

  const imageScale = (
    orgWidth: number,
    orgHeight: number,
    maxWidth = 250,
    maxHeight = 250
  ) => {
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
  };

  const scaleSize = imageScale(content.width, content.height);

  const getImageElement = () => {
    return (
      <img
        alt=""
        src={getImageSrc(content)}
        style={{
          borderRadius: "5px",
          width: scaleSize.width,
          height: scaleSize.height,
        }}
      />
    );
  };

  const handlePreview = () => {
    if (!message.messageSeq) {
      return;
    }
    WKApp.mittBus.emit("image-preview-click", {
      channelId: message.channel.channelID,
      messageSeq: message.messageSeq,
    });
    setShowPreview(true);
  };

  return (
    <MessageBase context={context} message={message}>
      <div
        style={{
          width: scaleSize.width,
          height: scaleSize.height,
          cursor: "pointer",
        }}
        onClick={handlePreview}
      >
        {getImageElement()}
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
          onChange={(activeImage, index) => {
            const messageSeq = (activeImage as any).messageSeq;
            if (messageSeq) {
              WKApp.mittBus.emit("image-preview-click", {
                channelId: message.channel.channelID,
                messageSeq: messageSeq,
              });
            }
          }}
          onMaskClick={() => setShowPreview(false)}
          onClose={() => setShowPreview(false)}
          images={images}
        />
      )}
    </MessageBase>
  );
};
