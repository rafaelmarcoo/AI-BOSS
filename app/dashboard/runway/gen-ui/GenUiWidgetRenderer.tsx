"use client";

import type { ComponentType } from "react";
import type { GenUiWidget } from "@/lib/gen-ui/types";
import { GEN_UI_RENDERER_REGISTRY } from "./renderer-registry";
import type { GenUiWidgetInteractionProps } from "./types";
import { Box } from "@mui/material";
import { WidgetFrame } from "./shared/WidgetFrame";
import { WidgetErrorState } from "./shared/WidgetErrorState";
import { WidgetLoadingState } from "./shared/WidgetLoadingState";
import { WidgetPartialState } from "./shared/WidgetPartialState";
import { WidgetUnavailableState } from "./shared/WidgetUnavailableState";

interface GenUiWidgetRendererProps extends GenUiWidgetInteractionProps {
  widget: GenUiWidget;
}

export function GenUiWidgetRenderer({
  widget,
  onAskChatbot,
}: GenUiWidgetRendererProps) {
  if (widget.state?.status === "loading") {
    return (
      <WidgetFrame title={widget.title} reason={widget.reason}>
        <WidgetLoadingState message={widget.state.message} />
      </WidgetFrame>
    );
  }

  if (widget.state?.status === "unavailable") {
    return (
      <WidgetFrame title={widget.title} reason={widget.reason}>
        <WidgetUnavailableState message={widget.state.message} />
      </WidgetFrame>
    );
  }

  if (widget.state?.status === "error") {
    return (
      <WidgetFrame title={widget.title} reason={widget.reason}>
        <WidgetErrorState message={widget.state.message} />
      </WidgetFrame>
    );
  }

  // The registry is exhaustive and validates each renderer against its exact
  // discriminated widget contract. This assertion is only needed because a
  // runtime union key cannot preserve that key/value correlation in JSX.
  const Renderer = GEN_UI_RENDERER_REGISTRY[widget.type] as ComponentType<
    GenUiWidgetRendererProps
  >;

  const rendered = <Renderer widget={widget} onAskChatbot={onAskChatbot} />;

  if (widget.state?.status === "partial") {
    return (
      <Box>
        <WidgetPartialState message={widget.state.message} />
        {rendered}
      </Box>
    );
  }

  return rendered;
}
