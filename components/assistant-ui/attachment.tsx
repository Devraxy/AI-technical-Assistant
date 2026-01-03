"use client";

import { PropsWithChildren, useEffect, useState, useMemo, memo, type FC } from "react";
import Image from "next/image";
import { XIcon, PlusIcon, FileText } from "lucide-react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAssistantState,
  useAssistantApi,
} from "@assistant-ui/react";
import { useShallow } from "zustand/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { cn } from "@/lib/utils";

const useFileSrc = (file: File | undefined) => {
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setSrc(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return src;
};

const useAttachmentSrc = () => {
  const { file, src } = useAssistantState(
    useShallow(({ attachment }): { file?: File; src?: string } => {
      if (attachment.type !== "image") return {};
      if (attachment.file) return { file: attachment.file };
      const src = attachment.content?.filter((c) => c.type === "image")[0]
        ?.image;
      if (!src) return {};
      return { src };
    }),
  );

  const fileSrc = useFileSrc(file);
  return fileSrc ?? src;
};

type AttachmentPreviewProps = {
  src: string;
};

const AttachmentPreview: FC<AttachmentPreviewProps> = memo(({ src }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <Image
      src={src}
      alt="Aperçu de l'image"
      width={1}
      height={1}
      className={
        isLoaded
          ? "aui-attachment-preview-image-loaded block h-auto max-h-[80vh] w-auto max-w-full object-contain"
          : "aui-attachment-preview-image-loading hidden"
      }
      onLoadingComplete={() => setIsLoaded(true)}
      priority={false}
      loading="lazy"
    />
  );
});
AttachmentPreview.displayName = 'AttachmentPreview';

const AttachmentPreviewDialog: FC<PropsWithChildren> = ({ children }) => {
  const src = useAttachmentSrc();

  if (!src) return children;

  return (
    <Dialog>
      <DialogTrigger
        className="aui-attachment-preview-trigger cursor-pointer transition-colors hover:bg-accent/50"
        asChild
      >
        {children}
      </DialogTrigger>
      <DialogContent className="aui-attachment-preview-dialog-content p-2 sm:max-w-3xl [&_svg]:text-background [&>button]:rounded-full [&>button]:bg-foreground/60 [&>button]:p-1 [&>button]:opacity-100 [&>button]:!ring-0 [&>button]:hover:[&_svg]:text-destructive">
        <DialogTitle className="aui-sr-only sr-only">
          Aperçu de la pièce jointe image
        </DialogTitle>
        <div className="aui-attachment-preview relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden bg-background">
          <AttachmentPreview src={src} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AttachmentThumb: FC = memo(() => {
  const isImage = useAssistantState(
    ({ attachment }) => attachment.type === "image",
  );
  const src = useAttachmentSrc();

  return (
    <Avatar className="aui-attachment-tile-avatar h-full w-full rounded-none">
      <AvatarImage
        src={src}
        alt="Aperçu de la pièce jointe"
        className="aui-attachment-tile-image object-cover"
        loading="lazy"
      />
      <AvatarFallback delayMs={isImage ? 200 : 0}>
        <FileText className="aui-attachment-tile-fallback-icon size-8 text-muted-foreground" />
      </AvatarFallback>
    </Avatar>
  );
});
AttachmentThumb.displayName = 'AttachmentThumb';

const AttachmentUI: FC = memo(() => {
  const api = useAssistantApi();
  const isComposer = api.attachment.source === "composer";

  // Combine multiple state calls into one for better performance
  const { isImage, typeLabel, attachmentName } = useAssistantState(
    useShallow(({ attachment }) => {
      const type = attachment.type;
      let label: string;
      switch (type) {
        case "image":
          label = "Image";
          break;
        case "document":
          label = "Document";
          break;
        case "file":
          label = "Fichier";
          break;
        default:
          const _exhaustiveCheck: never = type;
          throw new Error(`Type de pièce jointe inconnu : ${_exhaustiveCheck}`);
      }
      return {
        isImage: type === "image",
        typeLabel: label,
        attachmentName: attachment.name,
      };
    })
  );

  return (
    <Tooltip>
      <AttachmentPrimitive.Root
        className={cn(
          "aui-attachment-root relative",
          isImage &&
            "aui-attachment-root-composer only:[&>#attachment-tile]:size-24",
        )}
      >
        <AttachmentPreviewDialog>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "aui-attachment-tile size-14 cursor-pointer overflow-hidden rounded-[14px] border bg-muted transition-opacity hover:opacity-75",
                isComposer &&
                  "aui-attachment-tile-composer border-foreground/20",
              )}
              role="button"
              id="attachment-tile"
              aria-label={`Pièce jointe ${typeLabel.toLowerCase()}`}
            >
              <AttachmentThumb />
            </div>
          </TooltipTrigger>
        </AttachmentPreviewDialog>
        {isComposer && <AttachmentRemove />}
      </AttachmentPrimitive.Root>
      <TooltipContent side="top">
        {attachmentName && attachmentName !== 'file' && attachmentName !== 'File' 
          ? attachmentName 
          : typeLabel}
      </TooltipContent>
    </Tooltip>
  );
});
AttachmentUI.displayName = 'AttachmentUI';

const AttachmentRemove: FC = memo(() => {
  return (
    <AttachmentPrimitive.Remove asChild>
      <TooltipIconButton
        tooltip="Supprimer la pièce jointe"
        className="aui-attachment-tile-remove absolute top-1.5 right-1.5 size-3.5 rounded-full bg-white text-muted-foreground opacity-100 shadow-sm hover:!bg-white [&_svg]:text-black hover:[&_svg]:text-destructive"
        side="top"
      >
        <XIcon className="aui-attachment-remove-icon size-3 dark:stroke-[2.5px]" />
      </TooltipIconButton>
    </AttachmentPrimitive.Remove>
  );
});
AttachmentRemove.displayName = 'AttachmentRemove';

export const UserMessageAttachments: FC = memo(() => {
  return (
    <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2">
      <MessagePrimitive.Attachments components={{ Attachment: AttachmentUI }} />
    </div>
  );
});
UserMessageAttachments.displayName = 'UserMessageAttachments';

export const ComposerAttachments: FC = memo(() => {
  return (
    <div className="aui-composer-attachments mb-2 flex w-full flex-row items-center gap-2 overflow-x-auto px-1.5 pt-0.5 pb-1 empty:hidden">
      <ComposerPrimitive.Attachments
        components={{ Attachment: AttachmentUI }}
      />
    </div>
  );
});
ComposerAttachments.displayName = 'ComposerAttachments';

export const ComposerAddAttachment: FC = memo(() => {
  return (
    <ComposerPrimitive.AddAttachment asChild>
      <TooltipIconButton
        tooltip="Ajouter une pièce jointe"
        side="bottom"
        variant="ghost"
        size="icon"
        className="aui-composer-add-attachment size-[34px] rounded-full p-1 text-xs font-semibold hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30"
        aria-label="Ajouter une pièce jointe"
      >
        <PlusIcon className="aui-attachment-add-icon size-5 stroke-[1.5px]" />
      </TooltipIconButton>
    </ComposerPrimitive.AddAttachment>
  );
});
ComposerAddAttachment.displayName = 'ComposerAddAttachment';
