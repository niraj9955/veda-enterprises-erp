'use client'

import * as React from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  Power,
  PowerOff,
} from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

interface User {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: string
}

interface UserFormData {
  name: string
  email: string
  password: string
  role: string
}

// ── Constants ───────────────────────────────────────────────────────────────

const ROLES = ['admin', 'operator', 'accountant'] as const

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  operator: 'Operator',
  accountant: 'Accountant',
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  operator: 'bg-amber-100 text-amber-700 border-amber-200',
  accountant: 'bg-sky-100 text-sky-700 border-sky-200',
}

const emptyForm: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'operator',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

// ── Component ───────────────────────────────────────────────────────────────

export function UserManagementModule() {
  const currentUser = useAppStore((s) => s.user)

  // State
  const [users, setUsers] = React.useState<User[]>([])
  const [loading, setLoading] = React.useState(true)

  // Dialog states
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<User | null>(null)
  const [formData, setFormData] = React.useState<UserFormData>(emptyForm)
  const [formSubmitting, setFormSubmitting] = React.useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = React.useState<User | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // Toggle active loading
  const [togglingId, setTogglingId] = React.useState<string | null>(null)

  // ── Fetch users ─────────────────────────────────────────────────────────
  const fetchUsers = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getUsers()
      setUsers(res.users as User[])
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch users',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // ── Form handlers ───────────────────────────────────────────────────────
  const openAddDialog = () => {
    setEditingUser(null)
    setFormData(emptyForm)
    setFormOpen(true)
  }

  const openEditDialog = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    })
    setFormOpen(true)
  }

  const handleFormChange = (field: keyof UserFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Validation Error', description: 'Name is required', variant: 'destructive' })
      return
    }
    if (!formData.email.trim()) {
      toast({ title: 'Validation Error', description: 'Email is required', variant: 'destructive' })
      return
    }
    if (!editingUser && !formData.password.trim()) {
      toast({ title: 'Validation Error', description: 'Password is required for new users', variant: 'destructive' })
      return
    }

    setFormSubmitting(true)
    try {
      if (editingUser) {
        const payload: Record<string, unknown> = {
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          active: editingUser.active,
        }
        if (formData.password.trim()) {
          payload.password = formData.password.trim()
        }
        await api.updateUser(editingUser.id, payload)
        toast({ title: 'Success', description: 'User updated successfully' })
      } else {
        await api.createUser({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          role: formData.role,
        })
        toast({ title: 'Success', description: 'User created successfully' })
      }

      setFormOpen(false)
      setFormData(emptyForm)
      setEditingUser(null)
      fetchUsers()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save user',
        variant: 'destructive',
      })
    } finally {
      setFormSubmitting(false)
    }
  }

  // ── Toggle active handler ───────────────────────────────────────────────
  const handleToggleActive = async (user: User) => {
    setTogglingId(user.id)
    try {
      await api.updateUser(user.id, {
        name: user.name,
        email: user.email,
        role: user.role,
        active: !user.active,
      })
      toast({
        title: 'Success',
        description: `User ${!user.active ? 'activated' : 'deactivated'} successfully`,
      })
      fetchUsers()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to toggle user status',
        variant: 'destructive',
      })
    } finally {
      setTogglingId(null)
    }
  }

  // ── Delete handler ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return

    if (deleteTarget.id === currentUser?.id) {
      toast({
        title: 'Error',
        description: 'You cannot delete your own account',
        variant: 'destructive',
      })
      setDeleteTarget(null)
      return
    }

    setDeleting(true)
    try {
      await api.deleteUser(deleteTarget.id)
      toast({ title: 'Success', description: 'User deleted successfully' })
      setDeleteTarget(null)
      fetchUsers()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete user',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // ── Render: Loading skeletons ───────────────────────────────────────────
  const renderSkeletons = () =>
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-8 w-28" /></TableCell>
      </TableRow>
    ))

  // ── Render: Form dialog ─────────────────────────────────────────────────
  const renderFormDialog = () => (
    <Dialog open={formOpen} onOpenChange={setFormOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingUser ? 'Edit User' : 'Add User'}
          </DialogTitle>
          <DialogDescription>
            {editingUser
              ? 'Update the user details below.'
              : 'Fill in the details to create a new user.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="user-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-name"
              placeholder="Enter full name"
              value={formData.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="grid gap-2">
            <Label htmlFor="user-email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-email"
              type="email"
              placeholder="Enter email address"
              value={formData.email}
              onChange={(e) => handleFormChange('email', e.target.value)}
            />
          </div>

          {/* Password */}
          <div className="grid gap-2">
            <Label htmlFor="user-password">
              Password{' '}
              {editingUser ? (
                <span className="text-muted-foreground font-normal">(leave blank to keep existing)</span>
              ) : (
                <span className="text-destructive">*</span>
              )}
            </Label>
            <Input
              id="user-password"
              type="password"
              placeholder={editingUser ? 'Leave blank to keep existing' : 'Enter password'}
              value={formData.password}
              onChange={(e) => handleFormChange('password', e.target.value)}
            />
          </div>

          {/* Role */}
          <div className="grid gap-2">
            <Label htmlFor="user-role">Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => handleFormChange('role', value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setFormOpen(false)}
            disabled={formSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={formSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {formSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {editingUser ? 'Update User' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ── Render: Delete confirmation ─────────────────────────────────────────
  const renderDeleteDialog = () => (
    <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action
            cannot be undone. All data associated with this user will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  // ── Render: Role badge ──────────────────────────────────────────────────
  const renderRoleBadge = (role: string) => (
    <Badge className={ROLE_BADGE_STYLES[role] || 'bg-gray-100 text-gray-700 border-gray-200'}>
      {ROLE_LABELS[role] || role}
    </Badge>
  )

  // ── Render: Status badge ────────────────────────────────────────────────
  const renderStatusBadge = (active: boolean) => (
    <Badge
      className={
        active
          ? 'bg-green-100 text-green-700 border-green-200'
          : 'bg-red-100 text-red-700 border-red-200'
      }
    >
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )

  // ── Render: Main ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
            <p className="text-sm text-muted-foreground">
              Manage system users and their access roles
            </p>
          </div>
        </div>
        <Button
          onClick={openAddDialog}
          className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
        >
          <Plus className="size-4" />
          Add User
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Users</span>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {users.length} user{users.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletons()
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No users yet. Click &quot;Add User&quot; to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => {
                    const isSelf = user.id === currentUser?.id
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {user.name}
                            {isSelf && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-tight">
                                You
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>{renderRoleBadge(user.role)}</TableCell>
                        <TableCell>{renderStatusBadge(user.active)}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(user)}
                              title="Edit User"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(user)}
                              disabled={togglingId === user.id}
                              title={user.active ? 'Deactivate User' : 'Activate User'}
                              className={
                                user.active
                                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                                  : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                              }
                            >
                              {togglingId === user.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : user.active ? (
                                <PowerOff className="size-4" />
                              ) : (
                                <Power className="size-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(user)}
                              title="Delete User"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      {renderFormDialog()}
      {renderDeleteDialog()}
    </div>
  )
}

export default UserManagementModule
