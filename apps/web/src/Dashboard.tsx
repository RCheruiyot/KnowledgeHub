import { FormEvent, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Flex,
  Grid,
  Heading,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes';
import {
  Auth,
  Citation,
  Conversation,
  DocumentDetail,
  DocumentRecord,
  MemberRole,
  Message,
  WorkspaceMember,
  askQuestion,
  deleteDocument,
  getDocument,
  listConversations,
  listDocuments,
  listMembers,
  listMessages,
  reprocessDocument,
  uploadDocument,
} from './api';
import { WorkspaceSettings } from './WorkspaceSettings';

type Props = {
  auth: Auth;
  onSignOut: () => void;
};

export function Dashboard({ auth, onSignOut }: Props) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentDetail | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<MemberRole>(
    auth.organization.role || 'member',
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);

  useEffect(() => {
    void refreshWorkspace();
  }, [auth.token, auth.organization.id]);

  async function refreshWorkspace() {
    try {
      const [nextDocuments, nextConversations, nextMembers] = await Promise.all([
        listDocuments(auth),
        listConversations(auth),
        listMembers(auth),
      ]);

      setDocuments(nextDocuments);
      setConversations(nextConversations);
      setMembers(nextMembers.members);
      setCurrentUserRole(nextMembers.currentUserRole);

      if (selectedDocument) {
        const stillExists = nextDocuments.some((document) => document.id === selectedDocument.id);
        if (!stillExists) {
          setSelectedDocument(null);
        }
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load workspace');
    }
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;

    setBusy(true);
    setNotice('');

    try {
      const document = await uploadDocument(auth, file);
      setNotice(`${document.filename} is ready to ask about.`);
      setSelectedDocument(document);
      setFile(null);
      await refreshWorkspace();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleAsk(event: FormEvent) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    setBusy(true);
    setNotice('');

    try {
      const result = await askQuestion(auth, trimmedQuestion, activeConversationId);
      setActiveConversationId(result.conversationId);
      setQuestion('');
      setMessages((current) => [
        ...current,
        makeLocalMessage('user', trimmedQuestion),
        makeLocalMessage('assistant', result.answer, result.citations),
      ]);
      setConversations(await listConversations(auth));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Question failed');
    } finally {
      setBusy(false);
    }
  }

  async function openConversation(conversationId: string) {
    setBusy(true);
    setNotice('');

    try {
      setActiveConversationId(conversationId);
      setMessages(await listMessages(auth, conversationId));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load conversation');
    } finally {
      setBusy(false);
    }
  }

  function startNewConversation() {
    setActiveConversationId(undefined);
    setMessages([]);
    setQuestion('');
  }

  async function openDocument(documentId: string) {
    setDocumentBusy(true);
    setNotice('');

    try {
      setSelectedDocument(await getDocument(auth, documentId));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load document');
    } finally {
      setDocumentBusy(false);
    }
  }

  async function handleReprocessDocument(documentId: string) {
    setDocumentBusy(true);
    setNotice('');

    try {
      const document = await reprocessDocument(auth, documentId);
      setSelectedDocument(document);
      setNotice(`${document.filename} was reprocessed.`);
      await refreshWorkspace();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not reprocess document');
    } finally {
      setDocumentBusy(false);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    const document = documents.find((item) => item.id === documentId);
    const confirmed = window.confirm(`Delete ${document?.filename || 'this document'}?`);

    if (!confirmed) {
      return;
    }

    setDocumentBusy(true);
    setNotice('');

    try {
      await deleteDocument(auth, documentId);
      setSelectedDocument(null);
      setNotice(`${document?.filename || 'Document'} was deleted.`);
      await refreshWorkspace();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete document');
    } finally {
      setDocumentBusy(false);
    }
  }

  function handleMembersChanged(nextMembers: WorkspaceMember[], nextRole: MemberRole) {
    setMembers(nextMembers);
    setCurrentUserRole(nextRole);
  }

  const canUploadDocuments = ['owner', 'admin'].includes(currentUserRole);

  return (
    <Container size="4" style={{ padding: '24px 24px 72px' }}>
      <Flex align="center" gap="4" wrap="wrap">
        <Box>
          <Heading as="h1" size="5">
            {auth.organization.name}
          </Heading>
          <Text size="2" color="gray">
            KnowledgeHub workspace
          </Text>
        </Box>

        <Button variant="ghost" size="2" type="button" onClick={onSignOut} ml="auto">
          Sign out
        </Button>
      </Flex>

      <Grid columns={{ initial: '1', md: '280px 1fr' }} gap="4" mt="5">
        <Flex direction="column" gap="4">
          <WorkspaceSettings
            auth={auth}
            currentUserRole={currentUserRole}
            members={members}
            onChanged={handleMembersChanged}
            onNotice={setNotice}
          />

          <Card size="2">
            <Flex align="center" justify="between" gap="3">
              <Heading as="h2" size="3">
                Conversations
              </Heading>
              <Button size="1" variant="soft" type="button" onClick={startNewConversation}>
                New
              </Button>
            </Flex>

            <Flex direction="column" gap="2" mt="3">
              {conversations.length === 0 ? (
                <Text size="2" color="gray">
                  No chats yet.
                </Text>
              ) : (
                conversations.map((conversation) => (
                  <Button
                    key={conversation.id}
                    type="button"
                    variant={conversation.id === activeConversationId ? 'solid' : 'soft'}
                    color={conversation.id === activeConversationId ? 'violet' : 'gray'}
                    onClick={() => openConversation(conversation.id)}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    {conversation.title}
                  </Button>
                ))
              )}
            </Flex>
          </Card>

          <Card size="2">
            <Heading as="h2" size="3">
              Documents
            </Heading>

            {canUploadDocuments ? (
              <form onSubmit={handleUpload}>
                <Flex direction="column" gap="3" mt="3">
                  <input
                    type="file"
                    accept=".pdf,.docx,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                  />
                  <Button type="submit" disabled={!file || busy}>
                    {busy ? 'Working...' : 'Upload'}
                  </Button>
                </Flex>
              </form>
            ) : (
              <Text size="2" color="gray" as="p" mt="3">
                Members can ask questions, but only owners and admins can upload documents.
              </Text>
            )}

            <Separator size="4" my="4" />

            <Flex direction="column" gap="2">
              {documents.length === 0 ? (
                <Text size="2" color="gray">
                  Upload a PDF, DOCX, Markdown, or text file.
                </Text>
              ) : (
                documents.map((document) => (
                  <Flex key={document.id} align="center" gap="2">
                    <Button
                      type="button"
                      variant={selectedDocument?.id === document.id ? 'soft' : 'ghost'}
                      color={selectedDocument?.id === document.id ? 'violet' : 'gray'}
                      onClick={() => openDocument(document.id)}
                      style={{ flex: 1, justifyContent: 'flex-start', minWidth: 0 }}
                    >
                      {document.filename}
                    </Button>
                    <Badge color={statusColor(document.status)}>
                      {document.chunk_count}
                    </Badge>
                  </Flex>
                ))
              )}
            </Flex>
          </Card>
        </Flex>

        <Card size="3">
          <Flex direction="column" gap="4">
            <Box>
              <Text size="1" weight="bold" color="gray">
                YOUR KNOWLEDGE, ANSWERED
              </Text>
              <Heading as="h2" size="7" mt="2">
                Ask your workspace anything.
              </Heading>
              <Text size="3" color="gray" mt="2">
                Answers use your uploaded documents and include citations when sources are found.
              </Text>
            </Box>

            <form onSubmit={handleAsk}>
              <Flex gap="3" wrap="wrap">
                <TextField.Root style={{ flex: 1, minWidth: 260 }}>
                  <TextField.Input
                    placeholder="e.g. What is our refund policy?"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                  />
                </TextField.Root>
                <Button size="3" type="submit" disabled={busy || !question.trim()}>
                  Ask
                </Button>
              </Flex>
            </form>

            <MessageList messages={messages} />

            <DocumentDetails
              document={selectedDocument}
              canManageDocuments={canUploadDocuments}
              busy={documentBusy}
              onReprocess={handleReprocessDocument}
              onDelete={handleDeleteDocument}
            />

            {notice && (
              <Text size="2" color={noticeColor(notice)}>
                {notice}
              </Text>
            )}
          </Flex>
        </Card>
      </Grid>
    </Container>
  );
}

function DocumentDetails({
  document,
  canManageDocuments,
  busy,
  onReprocess,
  onDelete,
}: {
  document: DocumentDetail | null;
  canManageDocuments: boolean;
  busy: boolean;
  onReprocess: (documentId: string) => void;
  onDelete: (documentId: string) => void;
}) {
  if (!document) {
    return null;
  }

  return (
    <Card variant="surface">
      <Flex align="start" justify="between" gap="3" wrap="wrap">
        <Box>
          <Text size="1" weight="bold" color="gray">
            DOCUMENT
          </Text>
          <Heading as="h3" size="4" mt="1">
            {document.filename}
          </Heading>
          <Flex gap="2" mt="2" wrap="wrap">
            <Badge color={statusColor(document.status)}>{document.status}</Badge>
            <Badge color="gray">{document.chunk_count} chunks</Badge>
            <Badge color="gray">{document.mime_type}</Badge>
          </Flex>
        </Box>

        {canManageDocuments && (
          <Flex gap="2">
            <Button
              size="2"
              variant="soft"
              type="button"
              disabled={busy}
              onClick={() => onReprocess(document.id)}
            >
              Reprocess
            </Button>
            <Button
              size="2"
              variant="soft"
              color="red"
              type="button"
              disabled={busy}
              onClick={() => onDelete(document.id)}
            >
              Delete
            </Button>
          </Flex>
        )}
      </Flex>

      <Separator size="4" my="4" />

      {document.chunks.length === 0 ? (
        <Text size="2" color="gray">
          No chunks are stored for this document yet.
        </Text>
      ) : (
        <Flex direction="column" gap="3">
          {document.chunks.map((chunk) => (
            <Box key={chunk.id}>
              <Text size="2" weight="bold">
                Chunk {chunk.chunk_index + 1}
              </Text>
              <Text size="2" color="gray" as="p" mt="1">
                {chunk.preview}
                {chunk.content.length > chunk.preview.length ? '...' : ''}
              </Text>
            </Box>
          ))}
        </Flex>
      )}
    </Card>
  );
}

function MessageList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <Card variant="surface">
        <Text color="gray">
          Start a new question, or open a previous conversation from the sidebar.
        </Text>
      </Card>
    );
  }

  return (
    <Flex direction="column" gap="3">
      {messages.map((message) => (
        <Card key={message.id} variant={message.role === 'assistant' ? 'surface' : 'classic'}>
          <Text size="2" weight="bold" color={message.role === 'assistant' ? 'violet' : 'gray'}>
            {message.role === 'assistant' ? 'KnowledgeHub' : 'You'}
          </Text>
          <Text as="p" mt="2">
            {message.content}
          </Text>

          {message.citations.length > 0 && <Sources citations={message.citations} />}
        </Card>
      ))}
    </Flex>
  );
}

function Sources({ citations }: { citations: Citation[] }) {
  return (
    <Box mt="4">
      <Text size="2" weight="bold">
        Sources
      </Text>
      <Flex direction="column" gap="2" mt="2">
        {citations.map((citation) => (
          <Box key={`${citation.number}-${citation.filename}`}>
            <Text size="2" weight="bold">
              [{citation.number}] {citation.filename}
            </Text>
            <Text size="2" color="gray" as="div">
              {citation.excerpt}...
            </Text>
          </Box>
        ))}
      </Flex>
    </Box>
  );
}

function makeLocalMessage(role: Message['role'], content: string, citations: Citation[] = []) {
  return {
    id: `${role}-${Date.now()}-${Math.random()}`,
    role,
    content,
    citations,
    created_at: new Date().toISOString(),
  };
}

function statusColor(status: DocumentRecord['status']) {
  if (status === 'ready') return 'green';
  if (status === 'failed') return 'red';
  return 'yellow';
}

function noticeColor(notice: string) {
  if (
    notice.includes('ready') ||
    notice.includes('deleted') ||
    notice.includes('reprocessed')
  ) {
    return 'green';
  }

  return 'red';
}
