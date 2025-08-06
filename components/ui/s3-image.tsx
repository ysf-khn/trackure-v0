"use client";

import React, { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface S3ImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  quality?: number;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
}

export function S3Image({
  src,
  alt,
  className,
  width,
  height,
  fill = false,
  priority = false,
  quality = 85,
  placeholder,
  blurDataURL,
  onLoad,
  onError,
  fallbackSrc = "/placeholder-image.svg",
  objectFit = "cover",
}: S3ImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError && fallbackSrc) {
      setImgSrc(fallbackSrc);
      setHasError(true);
    }
    onError?.();
  };

  // For S3 URLs, we can use them directly
  // If using CloudFront, the URL should already be the CloudFront URL
  const imageUrl = imgSrc;

  if (fill) {
    return (
      <Image
        src={imageUrl}
        alt={alt}
        fill
        className={cn("object-cover", className)}
        style={{ objectFit }}
        priority={priority}
        quality={quality}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
        onLoad={onLoad}
        onError={handleError}
        unoptimized // Disable Next.js image optimization for S3 images
      />
    );
  }

  if (!width || !height) {
    // For dynamic sizing, use regular img tag
    return (
      <img
        src={imageUrl}
        alt={alt}
        className={className}
        onLoad={onLoad}
        onError={handleError}
        style={{ objectFit }}
      />
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{ objectFit }}
      priority={priority}
      quality={quality}
      placeholder={placeholder}
      blurDataURL={blurDataURL}
      onLoad={onLoad}
      onError={handleError}
      unoptimized // Disable Next.js image optimization for S3 images
    />
  );
}

// Lazy loading wrapper with intersection observer
export function LazyS3Image(props: S3ImageProps) {
  const [isInView, setIsInView] = useState(false);
  const imgRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "50px",
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={imgRef} className={props.className}>
      {isInView ? (
        <S3Image {...props} />
      ) : (
        <div
          className={cn(
            "bg-muted animate-pulse",
            props.fill ? "absolute inset-0" : "",
            props.className
          )}
          style={{
            width: props.width,
            height: props.height,
          }}
        />
      )}
    </div>
  );
}