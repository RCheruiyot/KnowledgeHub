const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type Auth = {
  token: string;
  organization: {
    id: string;
    name: string;
    role: MemberRole;
  };
};

export type MemberRole = 'owner' | 'admin' | 'member';

export type Citation = {
  number: number;
  filename: string;
  excerpt: string;
};

export type Conversation = {
  id: string;
  title: string;
  message_count: number;
  last_message_at: string | null;
};

export type DocumentRecord = {
  id: string;
  filename: string;
  mime_type: string;
  status: 'processing' | 'ready' | 'failed';
  created_at: string;
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  created_at: string;
};

export type WorkspaceMember = {
  user_id: string;
  email: string;
  role: MemberRole;
  joined_at: string;
};

export type WorkspaceMembersResponse = {
  currentUserRole: MemberRole;
  members: WorkspaceMember[];
};

type RequestOptions = RequestInit & {
  token?: string;
};

async function request<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set('authorization', `Bearer ${options.token}`);
  }

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || 'Request failed');
  }

  return data as T;
}

export function authenticate(mode: 'login' | 'register', email: string, password: string) {
  return request<Auth>(`/auth/${mode}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
}

export function listDocuments(auth: Auth) {
  return request<DocumentRecord[]>(`/organizations/${auth.organization.id}/documents`, {
    token: auth.token,
  });
}

export function uploadDocument(auth: Auth, file: File) {
  const body = new FormData();
  body.append('file', file);

  return request<DocumentRecord>(`/organizations/${auth.organization.id}/documents`, {
    method: 'POST',
    token: auth.token,
    body,
  });
}

export function askQuestion(auth: Auth, question: string, conversationId?: string) {
  return request<{
    conversationId: string;
    answer: string;
    citations: Citation[];
  }>(`/organizations/${auth.organization.id}/chat`, {
    method: 'POST',
    token: auth.token,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ question, conversationId }),
  });
}

export function listConversations(auth: Auth) {
  return request<Conversation[]>(`/organizations/${auth.organization.id}/chat/conversations`, {
    token: auth.token,
  });
}

export function listMessages(auth: Auth, conversationId: string) {
  return request<Message[]>(
    `/organizations/${auth.organization.id}/chat/conversations/${conversationId}/messages`,
    {
      token: auth.token,
    },
  );
}

export function listMembers(auth: Auth) {
  return request<WorkspaceMembersResponse>(
    `/organizations/${auth.organization.id}/members`,
    {
      token: auth.token,
    },
  );
}

export function addMember(auth: Auth, email: string, role: Exclude<MemberRole, 'owner'>) {
  return request<WorkspaceMembersResponse>(`/organizations/${auth.organization.id}/members`, {
    method: 'POST',
    token: auth.token,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, role }),
  });
}

export function updateMemberRole(auth: Auth, userId: string, role: MemberRole) {
  return request<WorkspaceMembersResponse>(
    `/organizations/${auth.organization.id}/members/${userId}`,
    {
      method: 'PATCH',
      token: auth.token,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ role }),
    },
  );
}

export function removeMember(auth: Auth, userId: string) {
  return request<WorkspaceMembersResponse>(
    `/organizations/${auth.organization.id}/members/${userId}`,
    {
      method: 'DELETE',
      token: auth.token,
    },
  );
}
