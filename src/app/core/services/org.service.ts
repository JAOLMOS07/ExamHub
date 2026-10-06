import { Injectable } from "@angular/core";
import {
  Firestore,
  collection,
  collectionData,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
} from "@angular/fire/firestore";
import { Observable, of } from "rxjs";
import { catchError, map, switchMap } from "rxjs/operators";
import {
  Group,
  Invite,
  Member,
  Organization,
  OrgSettings,
  Role,
  Student,
} from "../models/org.model";
import { StudentRow } from "../domain/studentsCsv";
import { TenantService } from "./tenant.service";

const BATCH_LIMIT = 400;

/**
 * Administración de la organización activa: datos del colegio,
 * miembros, invitaciones, grupos y estudiantes.
 *
 * Las reglas de Firestore son las que imponen quién puede escribir
 * (admin / coordinador); este servicio solo arma las operaciones.
 */
@Injectable({ providedIn: "root" })
export class OrgService {
  constructor(private firestore: Firestore, private tenant: TenantService) {}

  private list<T>(sub: string, sort?: (a: T, b: T) => number): Observable<T[]> {
    return this.tenant.activeOrgId$().pipe(
      switchMap(
        (orgId) =>
          collectionData(collection(this.firestore, `orgs/${orgId}/${sub}`), {
            idField: "id",
          }) as Observable<T[]>
      ),
      map((rows) => (sort ? rows.slice().sort(sort) : rows)),
      catchError((err) => {
        console.error(`[OrgService] no se pudo listar ${sub}:`, err);
        return of([] as T[]);
      })
    );
  }

  // ---------------- Organización ----------------

  async updateOrg(
    data: Partial<Pick<Organization, "name" | "nit" | "daneCode" | "city">> & {
      settings?: OrgSettings;
    }
  ): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );
    await updateDoc(doc(this.firestore, `orgs/${orgId}`), clean);
  }

  // ---------------- Miembros e invitaciones ----------------

  members$(): Observable<Member[]> {
    return this.list<Member>("members", (a, b) => a.email.localeCompare(b.email));
  }

  invites$(): Observable<Invite[]> {
    return this.list<Invite>("invites", (a, b) => b.createdAt - a.createdAt);
  }

  async invite(email: string, role: Role, orgName: string): Promise<void> {
    const { uid, orgId } = await this.tenant.requireContext();
    const normalized = email.trim().toLowerCase();
    const invite: Invite = {
      email: normalized,
      role,
      orgId,
      orgName,
      invitedBy: uid,
      createdAt: Date.now(),
    };
    await setDoc(doc(this.firestore, `orgs/${orgId}/invites/${normalized}`), invite);
  }

  async revokeInvite(email: string): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    await deleteDoc(doc(this.firestore, `orgs/${orgId}/invites/${email}`));
  }

  async setMemberRole(uid: string, role: Role): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    await updateDoc(doc(this.firestore, `orgs/${orgId}/members/${uid}`), { role });
  }

  async removeMember(uid: string): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    await deleteDoc(doc(this.firestore, `orgs/${orgId}/members/${uid}`));
  }

  // ---------------- Grupos ----------------

  groups$(): Observable<Group[]> {
    return this.list<Group>("groups", (a, b) =>
      b.year - a.year || a.name.localeCompare(b.name, "es", { numeric: true })
    );
  }

  async saveGroup(group: Omit<Group, "id"> & { id?: string }): Promise<string> {
    const orgId = await this.tenant.requireOrgId();
    const ref = group.id
      ? doc(this.firestore, `orgs/${orgId}/groups/${group.id}`)
      : doc(collection(this.firestore, `orgs/${orgId}/groups`));
    const { id: _id, ...data } = group;
    await setDoc(ref, stripUndefined(data));
    return ref.id;
  }

  async deleteGroup(groupId: string): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    await deleteDoc(doc(this.firestore, `orgs/${orgId}/groups/${groupId}`));
  }

  // ---------------- Estudiantes ----------------

  students$(): Observable<Student[]> {
    return this.list<Student>("students", (a, b) =>
      a.fullName.localeCompare(b.fullName, "es")
    );
  }

  async saveStudent(student: Omit<Student, "id"> & { id?: string }): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    const ref = student.id
      ? doc(this.firestore, `orgs/${orgId}/students/${student.id}`)
      : doc(collection(this.firestore, `orgs/${orgId}/students`));
    const { id: _id, ...data } = student;
    await setDoc(ref, data);
  }

  async deleteStudent(studentId: string): Promise<void> {
    const orgId = await this.tenant.requireOrgId();
    await deleteDoc(doc(this.firestore, `orgs/${orgId}/students/${studentId}`));
  }

  /**
   * Importa (o actualiza por código) un listado de estudiantes. Los
   * grupos que no existan se crean con el nombre indicado en la fila.
   * Devuelve cuántos se crearon/actualizaron.
   */
  async importStudents(
    rows: StudentRow[],
    opts: {
      year: number;
      defaultGroupId: string | null;
      existing: Student[];
      groups: Group[];
    }
  ): Promise<{ created: number; updated: number; groupsCreated: number }> {
    const orgId = await this.tenant.requireOrgId();
    const groupByName = new Map(
      opts.groups
        .filter((g) => g.year === opts.year)
        .map((g) => [g.name.trim().toLowerCase(), g.id])
    );
    const byCode = new Map(opts.existing.map((s) => [s.code, s]));
    let groupsCreated = 0;
    let created = 0;
    let updated = 0;

    let batch = writeBatch(this.firestore);
    let ops = 0;
    const flush = async () => {
      if (ops === 0) return;
      await batch.commit();
      batch = writeBatch(this.firestore);
      ops = 0;
    };

    for (const row of rows) {
      let groupId = opts.defaultGroupId;
      if (row.group) {
        const key = row.group.trim().toLowerCase();
        groupId = groupByName.get(key) ?? null;
        if (!groupId) {
          const gRef = doc(collection(this.firestore, `orgs/${orgId}/groups`));
          batch.set(gRef, { name: row.group.trim(), year: opts.year, ...gradeFromName(row.group) });
          ops++;
          groupId = gRef.id;
          groupByName.set(key, groupId);
          groupsCreated++;
        }
      }
      const existing = byCode.get(row.code);
      const ref = existing
        ? doc(this.firestore, `orgs/${orgId}/students/${existing.id}`)
        : doc(collection(this.firestore, `orgs/${orgId}/students`));
      batch.set(ref, {
        code: row.code,
        fullName: row.fullName,
        groupId,
        year: opts.year,
        active: true,
      } satisfies Omit<Student, "id">);
      ops++;
      existing ? updated++ : created++;
      if (ops >= BATCH_LIMIT) await flush();
    }
    await flush();
    return { created, updated, groupsCreated };
  }
}

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== "")
  ) as T;
}

/** "11-A" → { grade: 11 }. */
function gradeFromName(name: string): { grade?: number } {
  const m = name.match(/^\s*(\d{1,2})/);
  return m ? { grade: parseInt(m[1], 10) } : {};
}
