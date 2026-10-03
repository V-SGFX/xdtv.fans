import { Controller, Get, Patch, Param, Query, Body, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req) {
    return this.usersService.getMe(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Body() body, @Req() req) {
    return this.usersService.updateMe(req.user.userId, body);
  }

  @Get('me/posts')
  @UseGuards(JwtAuthGuard)
  getMyPosts(@Req() req, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.getMyPosts(req.user.userId, Math.max(1, page), Math.min(100, Math.max(1, limit)));
  }

  @Get('username/:username')
  findByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  @Get('username/:username/posts')
  getPostsByUsername(@Param('username') username: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.getPostsByUsername(username, Math.max(1, page), Math.min(100, Math.max(1, limit)));
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.findAll(Math.max(1, page), Math.min(100, Math.max(1, limit)));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() body, @Req() req) {
    return this.usersService.update(id, req.user.userId, req.user.role, body);
  }
}
