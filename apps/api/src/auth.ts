import { Body, Controller, Injectable, Post, UnauthorizedException } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { DatabaseService } from './database.service';
class Credentials { @IsEmail() email!: string; @IsString() @MinLength(8) password!: string; }
@Injectable()
export class AuthService {
  constructor(private db: DatabaseService) {}
  private token(userId: string) { return sign({ sub: userId }, process.env.JWT_SECRET || 'development-only-secret', { expiresIn: '7d' }); }
  async register(dto: Credentials) { const hash = await bcrypt.hash(dto.password, 12); const client = await this.db.connect(); try { await client.query('BEGIN'); const user = await client.query('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id,email', [dto.email, hash]); const org = await client.query('INSERT INTO organizations(name) VALUES($1) RETURNING id,name', [dto.email.split('@')[0] + "'s workspace"]); await client.query("INSERT INTO memberships(user_id,organization_id,role) VALUES($1,$2,'owner')", [user.rows[0].id, org.rows[0].id]); await client.query('COMMIT'); return { token: this.token(user.rows[0].id), user: user.rows[0], organization: org.rows[0] }; } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); } }
  async login(dto: Credentials) { const result = await this.db.query('SELECT id,email,password_hash FROM users WHERE email=$1', [dto.email]); const user = result.rows[0]; if (!user || !(await bcrypt.compare(dto.password, user.password_hash))) throw new UnauthorizedException('Invalid email or password'); const org = await this.db.query('SELECT o.id,o.name,m.role FROM organizations o JOIN memberships m ON m.organization_id=o.id WHERE m.user_id=$1 LIMIT 1', [user.id]); return { token: this.token(user.id), user: { id: user.id, email: user.email }, organization: org.rows[0] }; }
}
@Controller('auth') export class AuthController { constructor(private auth: AuthService) {} @Post('register') register(@Body() dto: Credentials) { return this.auth.register(dto); } @Post('login') login(@Body() dto: Credentials) { return this.auth.login(dto); } }
