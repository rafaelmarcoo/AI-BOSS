"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import { dashboardTokens } from "@/app/theme";
import { ChatContainer } from "./ChatContainer";
import { useChatConversation } from "./useChatConversation";
import { useDocuments } from "./useDocuments";
import type { GenUiPlan } from "@/lib/gen-ui/types";
import type { UserType } from "@/types/database";

interface SelectionChatPrompt {
  id: string;
  text: string;
}

interface ChatSidebarProps {
  fullName: string | null;
  email: string;
  userType: UserType | null;
  initialConversationId?: string | null;
  initialMessage?: string | null;
  onDocumentsProcessed?: () => void;
  onInitialMessageHandled?: () => void;
  selectionPrompt?: SelectionChatPrompt | null;
  onSelectionPromptHandled?: () => void;
  onGenUiPlan?: (plan: GenUiPlan | null) => void;
}

function getConversationGroupLabel(updatedAt: string) {
  const updatedDate = new Date(updatedAt)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfUpdatedDate = new Date(
    updatedDate.getFullYear(),
    updatedDate.getMonth(),
    updatedDate.getDate(),
  )
  const differenceInDays = Math.floor(
    (startOfToday.getTime() - startOfUpdatedDate.getTime()) / 86_400_000,
  )

  if (differenceInDays <= 0) return "Today"
  if (differenceInDays === 1) return "Yesterday"
  if (differenceInDays < 7) return "Previous 7 days"
  if (differenceInDays < 30) return "Previous 30 days"
  return "Older"
}

export function ChatSidebar({
  fullName,
  email,
  userType,
  initialConversationId = null,
  initialMessage = null,
  onDocumentsProcessed,
  onInitialMessageHandled,
  selectionPrompt,
  onSelectionPromptHandled,
  onGenUiPlan,
}: ChatSidebarProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuConversationId, setMenuConversationId] = useState<string | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const [renamingConversationId, setRenamingConversationId] = useState<
    string | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const lastHandledPromptId = useRef<string | null>(null);
  const lastHandledInitialMessage = useRef<string | null>(null);
  const {
    conversationId,
    isReadOnly,
    visibility,
    changeVisibility,
    conversationMessages,
    loading,
    error,
    conversations,
    historyLoading,
    sendMessage,
    retryMessage,
    selectConversation,
    startNewConversation,
    renameConversation,
    deleteConversation,
  } = useChatConversation({
    initialConversationId,
    startEmpty: Boolean(initialMessage) && !initialConversationId,
    onGenUiPlan,
  });
  const {
    documents,
    documentsLoading,
    uploading,
    documentsError,
    uploadDocument,
  } = useDocuments(conversationId, { onDocumentsProcessed });

  const activeConversation =
    conversations.find((conversation) => conversation.id === conversationId) ??
    null;
  const groupedConversations = conversations.reduce<
    Array<{ label: string; conversations: typeof conversations }>
  >((groups, conversation) => {
    const label = getConversationGroupLabel(conversation.updated_at)
    const group = groups.find((candidate) => candidate.label === label)

    if (group) {
      group.conversations.push(conversation)
    } else {
      groups.push({ label, conversations: [conversation] })
    }

    return groups
  }, [])

  useEffect(() => {
    setSelectedConversationId(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (!selectionPrompt) {
      return;
    }

    if (lastHandledPromptId.current === selectionPrompt.id) {
      return;
    }

    lastHandledPromptId.current = selectionPrompt.id;

    void sendMessage(selectionPrompt.text).finally(() => {
      onSelectionPromptHandled?.();
    });
  }, [onSelectionPromptHandled, selectionPrompt, sendMessage]);

  useEffect(() => {
    if (!initialMessage || historyLoading) {
      return;
    }

    if (lastHandledInitialMessage.current === initialMessage) {
      return;
    }

    lastHandledInitialMessage.current = initialMessage;

    void sendMessage(initialMessage).finally(() => {
      onInitialMessageHandled?.();
    });
  }, [historyLoading, initialMessage, onInitialMessageHandled, sendMessage]);

  const handleSelectConversation = async (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setActionError(null);
    await selectConversation(conversationId);
    setHistoryOpen(false);
  };

  const handleStartNewConversation = () => {
    setSelectedConversationId(null);
    setActionError(null);
    startNewConversation();
    setHistoryOpen(false);
  };

  const openConversationMenu = (
    event: React.MouseEvent<HTMLElement>,
    conversationId: string,
    title: string | null,
  ) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuConversationId(conversationId);
    setRenameValue(title ?? "");
  };

  const closeConversationMenu = () => {
    setMenuAnchorEl(null);
    setMenuConversationId(null);
  };

  const startRenameConversation = () => {
    setRenamingConversationId(menuConversationId);
    closeConversationMenu();
  };

  const closeRenameDialog = () => {
    setRenamingConversationId(null);
    setRenameValue("");
  };

  const submitRenameConversation = async () => {
    if (!renamingConversationId) {
      return;
    }

    try {
      setActionError(null);
      await renameConversation(renamingConversationId, renameValue);
      closeRenameDialog();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not rename the conversation.",
      );
    }
  };

  const handleDeleteConversation = async () => {
    if (!menuConversationId) {
      return;
    }

    try {
      setActionError(null);
      await deleteConversation(menuConversationId);
      closeConversationMenu();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not delete the conversation.",
      );
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        borderRight: { md: "1px solid" },
        borderRightColor: { md: dashboardTokens.border },
        borderBottom: { xs: "1px solid", md: "none" },
        borderBottomColor: { xs: dashboardTokens.border, md: "transparent" },
        bgcolor: dashboardTokens.sidebarV2,
      }}
    >
      <Box
        sx={{
          p: { xs: 1, md: 1.5 },
          flex: "1 1 0",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <ChatContainer
          fullName={fullName}
          email={email}
          userType={userType}
          activeConversationTitle={activeConversation?.title ?? null}
          readOnly={isReadOnly}
          visibility={visibility}
          visibilityLocked={isReadOnly}
          onVisibilityChange={(nextVisibility) => {
            void changeVisibility(nextVisibility).catch(() => undefined)
          }}
          conversationMessages={conversationMessages}
          documents={documents}
          documentsLoading={documentsLoading}
          documentsError={documentsError}
          historyLoading={historyLoading}
          loading={loading}
          uploading={uploading}
          error={error}
          onOpenHistory={() => setHistoryOpen(true)}
          onSendMessage={sendMessage}
          onUploadDocument={uploadDocument}
          onRetryMessage={retryMessage}
        />
      </Box>
      <Drawer
        anchor="left"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 380 },
            maxWidth: "100vw",
            bgcolor: "#080910",
            color: "common.white",
            borderRight: "1px solid",
            borderRightColor: dashboardTokens.border,
            p: { xs: 1, sm: 1.5 },
            boxSizing: "border-box",
            overflowX: "hidden",
          },
        }}
      >
        <Stack spacing={1.5} sx={{ height: "100%", minWidth: 0 }}>
          <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            spacing={1}
            sx={{ px: 0.5, pt: 0.5, minWidth: 0 }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ minWidth: 0, width: "100%" }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.08)",
                  flex: "0 0 auto",
                }}
              >
                <ForumRoundedIcon sx={{ color: "common.white", fontSize: 20 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                  AI-BOSS chats
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: dashboardTokens.textMuted,
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fullName ?? email}
                </Typography>
              </Box>
            </Stack>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddRoundedIcon fontSize="small" />}
              onClick={handleStartNewConversation}
              sx={{
                alignSelf: "center",
                borderRadius: 2,
                color: "common.white",
                borderColor: dashboardTokens.borderMuted,
                textTransform: "none",
                whiteSpace: "nowrap",
              }}
            >
              New chat
            </Button>
          </Stack>

          {actionError ? (
            <Alert
              severity="error"
              onClose={() => setActionError(null)}
              sx={{ borderRadius: 2 }}
            >
              {actionError}
            </Alert>
          ) : null}

          <Box
            sx={{
              flex: "1 1 0",
              minHeight: 0,
              overflow: "auto",
              pr: 0.5,
            }}
          >
            {historyLoading ? (
              <Typography
                variant="body2"
                sx={{ color: dashboardTokens.textMuted, p: 1 }}
              >
                Loading conversations...
              </Typography>
            ) : conversations.length === 0 ? (
              <Typography
                variant="body2"
                sx={{ color: dashboardTokens.textMuted, p: 1 }}
              >
                No saved conversations yet.
              </Typography>
            ) : (
              <Stack spacing={1.75}>
                {groupedConversations.map((group) => (
                  <Box key={group.label}>
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        px: 1,
                        pb: 0.6,
                        color: dashboardTokens.textMuted,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {group.label}
                    </Typography>
                    <List
                      disablePadding
                      sx={{ display: "grid", gap: 0.75, minWidth: 0 }}
                    >
                      {group.conversations.map((conversation) => (
                        <ListItem
                          key={conversation.id}
                          disablePadding
                          sx={{ minWidth: 0 }}
                        >
                          <ListItemButton
                            selected={selectedConversationId === conversation.id}
                            onClick={() =>
                              void handleSelectConversation(conversation.id)
                            }
                            sx={{
                              width: "100%",
                              px: 1.25,
                              py: 1,
                              borderRadius: 2.5,
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              minWidth: 0,
                              bgcolor:
                                selectedConversationId === conversation.id
                                  ? "rgba(255,255,255,0.10)"
                                  : "rgba(255,255,255,0.02)",
                              border: "1px solid",
                              borderColor:
                                selectedConversationId === conversation.id
                                  ? "rgba(255,255,255,0.16)"
                                  : "transparent",
                              "&:hover": {
                                bgcolor: "rgba(255,255,255,0.08)",
                              },
                              "&.Mui-selected": {
                                bgcolor: "rgba(255,255,255,0.10)",
                              },
                            }}
                          >
                            <Tooltip
                              title={
                                conversation.title ?? "Untitled conversation"
                              }
                              placement="right"
                            >
                              <ListItemText
                                primary={
                                  conversation.title ?? "Untitled conversation"
                                }
                                secondary={
                                  new Date(conversation.updated_at).toLocaleString() +
                                  (conversation.visibility === "private"
                                    ? " · Private"
                                    : conversation.visibility === "admins"
                                      ? " · Admins"
                                      : conversation.isOwner
                                        ? ""
                                        : " · Company chat")
                                }
                                primaryTypographyProps={{
                                  color: "common.white",
                                  fontSize: 14,
                                  lineHeight: 1.25,
                                  noWrap: false,
                                  sx: {
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                  },
                                }}
                                secondaryTypographyProps={{
                                  color: dashboardTokens.textMuted,
                                  fontSize: 12,
                                  noWrap: true,
                                }}
                                sx={{ minWidth: 0, flex: "1 1 auto", mr: 0.25 }}
                              />
                            </Tooltip>
                            {conversation.isOwner ? (
                              <IconButton
                                size="small"
                                onClick={(event) =>
                                  openConversationMenu(
                                    event,
                                    conversation.id,
                                    conversation.title,
                                  )
                                }
                                sx={{
                                  color: dashboardTokens.textMuted,
                                  flex: "0 0 34px",
                                  width: 34,
                                  height: 34,
                                  mr: -0.25,
                                  "&:hover": {
                                    bgcolor: "transparent",
                                  },
                                }}
                              >
                                <MoreHorizRoundedIcon fontSize="small" />
                              </IconButton>
                            ) : null}
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </Drawer>
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={closeConversationMenu}
        PaperProps={{
          sx: {
            bgcolor: "#111218",
            color: "common.white",
            border: "1px solid",
            borderColor: dashboardTokens.border,
          },
        }}
      >
        <MenuItem onClick={startRenameConversation}>Rename</MenuItem>
        <MenuItem
          onClick={() => void handleDeleteConversation()}
          sx={{ color: "#fca5a5" }}
        >
          Delete
        </MenuItem>
      </Menu>
      <Dialog
        open={Boolean(renamingConversationId)}
        onClose={closeRenameDialog}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            bgcolor: "#111218",
            color: "common.white",
            border: "1px solid",
            borderColor: dashboardTokens.border,
          },
        }}
      >
        <DialogTitle>Rename conversation</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            value={renameValue}
            autoFocus
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitRenameConversation();
              }
            }}
            placeholder="Conversation name"
            sx={{
              mt: 1,
              "& .MuiOutlinedInput-root": {
                borderRadius: 2.5,
                color: "common.white",
                bgcolor: "rgba(255,255,255,0.04)",
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={closeRenameDialog}
            sx={{ color: dashboardTokens.textMuted }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void submitRenameConversation()}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
