import { FormEvent, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Select,
  Text,
  TextField,
} from '@radix-ui/themes';
import {
  Auth,
  MemberRole,
  WorkspaceMember,
  addMember,
  removeMember,
  updateMemberRole,
} from './api';

type Props = {
  auth: Auth;
  currentUserRole: MemberRole;
  members: WorkspaceMember[];
  onChanged: (members: WorkspaceMember[], currentUserRole: MemberRole) => void;
  onNotice: (notice: string) => void;
};

export function WorkspaceSettings({
  auth,
  currentUserRole,
  members,
  onChanged,
  onNotice,
}: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<MemberRole, 'owner'>>('member');
  const [busyUserId, setBusyUserId] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const canManageMembers = ['owner', 'admin'].includes(currentUserRole);
  const canManageRoles = currentUserRole === 'owner';

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();

    if (!email.trim()) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await addMember(auth, email.trim(), role);
      onChanged(response.members, response.currentUserRole);
      setEmail('');
      setRole('member');
      onNotice(`${email.trim()} was added to the workspace.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not add member');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(member: WorkspaceMember, nextRole: MemberRole) {
    setBusyUserId(member.user_id);

    try {
      const response = await updateMemberRole(auth, member.user_id, nextRole);
      onChanged(response.members, response.currentUserRole);
      onNotice(`${member.email} is now ${nextRole}.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not update role');
    } finally {
      setBusyUserId(undefined);
    }
  }

  async function handleRemove(member: WorkspaceMember) {
    setBusyUserId(member.user_id);

    try {
      const response = await removeMember(auth, member.user_id);
      onChanged(response.members, response.currentUserRole);
      onNotice(`${member.email} was removed.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not remove member');
    } finally {
      setBusyUserId(undefined);
    }
  }

  return (
    <Card size="2">
      <Flex align="start" justify="between" gap="3">
        <Box>
          <Heading as="h2" size="3">
            Workspace
          </Heading>
          <Text size="2" color="gray">
            Members and roles
          </Text>
        </Box>
        <Badge color={roleColor(currentUserRole)}>{currentUserRole}</Badge>
      </Flex>

      {canManageMembers && (
        <form onSubmit={handleAddMember}>
          <Flex direction="column" gap="2" mt="4">
            <TextField.Root>
              <TextField.Input
                type="email"
                placeholder="teammate@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </TextField.Root>

            <Flex gap="2">
              <Select.Root
                value={role}
                onValueChange={(value) => setRole(value as Exclude<MemberRole, 'owner'>)}
              >
                <Select.Trigger style={{ flex: 1 }} />
                <Select.Content>
                  <Select.Item value="member">member</Select.Item>
                  {currentUserRole === 'owner' && <Select.Item value="admin">admin</Select.Item>}
                </Select.Content>
              </Select.Root>

              <Button type="submit" disabled={submitting || !email.trim()}>
                Add
              </Button>
            </Flex>
          </Flex>
        </form>
      )}

      <Flex direction="column" gap="3" mt="4">
        {members.map((member) => (
          <Flex key={member.user_id} align="center" gap="3" wrap="wrap">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="2" weight="bold">
                {member.email}
              </Text>
            </Box>

            {canManageRoles ? (
              <Select.Root
                value={member.role}
                onValueChange={(value) => handleRoleChange(member, value as MemberRole)}
                disabled={busyUserId === member.user_id}
              >
                <Select.Trigger style={{ width: 104 }} />
                <Select.Content>
                  <Select.Item value="owner">owner</Select.Item>
                  <Select.Item value="admin">admin</Select.Item>
                  <Select.Item value="member">member</Select.Item>
                </Select.Content>
              </Select.Root>
            ) : (
              <Badge color={roleColor(member.role)}>{member.role}</Badge>
            )}

            {canManageMembers && member.role !== 'owner' && (
              <Button
                type="button"
                size="1"
                variant="soft"
                color="red"
                disabled={busyUserId === member.user_id}
                onClick={() => handleRemove(member)}
              >
                Remove
              </Button>
            )}
          </Flex>
        ))}
      </Flex>
    </Card>
  );
}

function roleColor(role: MemberRole) {
  if (role === 'owner') return 'violet';
  if (role === 'admin') return 'blue';
  return 'gray';
}
