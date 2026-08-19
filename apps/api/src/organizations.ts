import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsIn } from 'class-validator';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { DatabaseService } from './database.service';

type MemberRole = 'owner' | 'admin' | 'member';
type AuthedRequest = Request & { user: { sub: string } };

class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsIn(['admin', 'member'])
  role!: Exclude<MemberRole, 'owner'>;
}

class UpdateMemberRoleDto {
  @IsIn(['owner', 'admin', 'member'])
  role!: MemberRole;
}

@Injectable()
export class OrganizationsService {
  constructor(private db: DatabaseService) {}

  async members(organizationId: string, userId: string) {
    const requester = await this.requireMember(organizationId, userId);
    const members = await this.db.query(
      `
        SELECT
          u.id user_id,
          u.email,
          m.role,
          u.created_at joined_at
        FROM memberships m
        JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = $1
        ORDER BY
          CASE m.role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            ELSE 3
          END,
          u.email ASC
      `,
      [organizationId],
    );

    return {
      currentUserRole: requester.role,
      members: members.rows,
    };
  }

  async addMember(organizationId: string, userId: string, dto: AddMemberDto) {
    const requester = await this.requireMember(organizationId, userId);
    this.requireMemberManager(requester.role);

    if (dto.role === 'admin' && requester.role !== 'owner') {
      throw new ForbiddenException('Only owners can add admins');
    }

    const user = await this.db.query('SELECT id,email FROM users WHERE email=$1', [
      dto.email.toLowerCase(),
    ]);

    if (!user.rows[0]) {
      throw new BadRequestException('That user must register before you can add them');
    }

    try {
      await this.db.query(
        'INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,$3)',
        [user.rows[0].id, organizationId, dto.role],
      );
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('That user is already a member');
      }

      throw error;
    }

    return this.members(organizationId, userId);
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    memberUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const requester = await this.requireMember(organizationId, userId);

    if (requester.role !== 'owner') {
      throw new ForbiddenException('Only owners can change roles');
    }

    const target = await this.requireMember(organizationId, memberUserId);

    if (target.role === 'owner' && dto.role !== 'owner') {
      await this.requireAnotherOwner(organizationId, memberUserId);
    }

    await this.db.query(
      'UPDATE memberships SET role=$1 WHERE organization_id=$2 AND user_id=$3',
      [dto.role, organizationId, memberUserId],
    );

    return this.members(organizationId, userId);
  }

  async removeMember(organizationId: string, userId: string, memberUserId: string) {
    const requester = await this.requireMember(organizationId, userId);
    this.requireMemberManager(requester.role);

    const target = await this.requireMember(organizationId, memberUserId);

    if (target.role !== 'member' && requester.role !== 'owner') {
      throw new ForbiddenException('Only owners can remove admins or owners');
    }

    if (target.role === 'owner') {
      await this.requireAnotherOwner(organizationId, memberUserId);
    }

    await this.db.query('DELETE FROM memberships WHERE organization_id=$1 AND user_id=$2', [
      organizationId,
      memberUserId,
    ]);

    return this.members(organizationId, userId);
  }

  private async requireMember(organizationId: string, userId: string) {
    const membership = await this.db.query(
      'SELECT role FROM memberships WHERE organization_id=$1 AND user_id=$2',
      [organizationId, userId],
    );

    if (!membership.rows[0]) {
      throw new BadRequestException('Organization access denied');
    }

    return membership.rows[0] as { role: MemberRole };
  }

  private requireMemberManager(role: MemberRole) {
    if (!['owner', 'admin'].includes(role)) {
      throw new ForbiddenException('Only owners and admins can manage members');
    }
  }

  private async requireAnotherOwner(organizationId: string, ownerUserId: string) {
    const owners = await this.db.query(
      `
        SELECT COUNT(*)::int count
        FROM memberships
        WHERE organization_id=$1
          AND role='owner'
          AND user_id <> $2
      `,
      [organizationId, ownerUserId],
    );

    if (owners.rows[0].count === 0) {
      throw new BadRequestException('A workspace must have at least one owner');
    }
  }
}

@Controller('organizations/:organizationId')
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private organizations: OrganizationsService) {}

  @Get('members')
  members(@Param('organizationId') organizationId: string, @Req() req: AuthedRequest) {
    return this.organizations.members(organizationId, req.user.sub);
  }

  @Post('members')
  addMember(
    @Param('organizationId') organizationId: string,
    @Body() dto: AddMemberDto,
    @Req() req: AuthedRequest,
  ) {
    return this.organizations.addMember(organizationId, req.user.sub, dto);
  }

  @Patch('members/:memberUserId')
  updateMemberRole(
    @Param('organizationId') organizationId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: AuthedRequest,
  ) {
    return this.organizations.updateMemberRole(
      organizationId,
      req.user.sub,
      memberUserId,
      dto,
    );
  }

  @Delete('members/:memberUserId')
  removeMember(
    @Param('organizationId') organizationId: string,
    @Param('memberUserId') memberUserId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.organizations.removeMember(organizationId, req.user.sub, memberUserId);
  }
}
