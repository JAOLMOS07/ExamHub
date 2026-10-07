import { Injectable } from "@angular/core";
import { Auth, authState, User } from "@angular/fire/auth";
import {
  Firestore,
  collection,
  collectionData,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  docData,
  getDoc,
  getDocFromServer,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "@angular/fire/firestore";
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  firstValueFrom,
  from,
  of,
} from "rxjs";
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  retry,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs/operators";
import {
  DEFAULT_ORG_SETTINGS,
  Invite,
  Member,
  Organization,
  Role,
  UserProfile,
  personalOrgId,
} from "../models/org.model";

/**
 * Contexto de sesión multi-organización.
 *
 * Responsabilidades:
 *   - Asegura que todo usuario tenga perfil y al menos una organización
 *     (crea su espacio personal la primera vez).
 *   - Expone la organización activa, su documento y el rol del usuario.
 *   - Cambiar de organización, crear un colegio y aceptar invitaciones.
 *
 * Los repositorios (banco, evaluaciones, estudiantes) piden el orgId
 * acá: así ninguno arma rutas con un uid nulo ni depende del orden en
 * que Firebase Auth termina de hidratar la sesión.
 */
@Injectable({ providedIn: "root" })
export class TenantService {
  readonly user$: Observable<User | null>;
  readonly profile$: Observable<UserProfile | null>;
  readonly orgId$: Observable<string | null>;
  /** uid + organización activa, tomados del mismo perfil. */
  private readonly context$: Observable<{ uid: string; orgId: string | null } | null>;
  readonly org$: Observable<Organization | null>;
  readonly membership$: Observable<Member | null>;
  readonly role$: Observable<Role | null>;
  readonly pendingInvites$: Observable<Invite[]>;

  private readonly snapshot = new BehaviorSubject<{
    uid: string | null;
    email: string | null;
    orgId: string | null;
    role: Role | null;
  }>({ uid: null, email: null, orgId: null, role: null });

  constructor(private auth: Auth, private firestore: Firestore) {
    this.user$ = authState(this.auth).pipe(shareReplay(1));

    this.profile$ = this.user$.pipe(
      switchMap((user) =>
        user
          ? from(this.bootstrap(user)).pipe(
              switchMap(
                () =>
                  docData(doc(this.firestore, `users/${user.uid}`)) as Observable<
                    UserProfile | undefined
                  >
              ),
              map((p) => p ?? null),
              catchError((err) => {
                console.error("[Tenant] No se pudo cargar el perfil:", err);
                return of(null);
              }),
              // Al cambiar de usuario no se reusa ni un instante el perfil
              // (ni la organización activa) del usuario anterior.
              startWith(null)
            )
          : of(null)
      ),
      shareReplay(1)
    );

    // Usuario + organización SIEMPRE del mismo perfil.
    this.context$ = this.profile$.pipe(
      map((p) => (p ? { uid: p.uid, orgId: activeOrgOf(p) } : null)),
      distinctUntilChanged((a, b) => a?.uid === b?.uid && a?.orgId === b?.orgId),
      shareReplay(1)
    );

    this.orgId$ = this.context$.pipe(
      map((c) => c?.orgId ?? null),
      distinctUntilChanged(),
      shareReplay(1)
    );

    this.org$ = this.orgId$.pipe(
      switchMap((orgId) =>
        orgId
          ? (docData(doc(this.firestore, `orgs/${orgId}`), {
              idField: "id",
            }) as Observable<Organization>).pipe(
              retry({ count: 4, delay: 1000 }),
              catchError(() => of(null))
            )
          : of(null)
      ),
      shareReplay(1)
    );

    this.membership$ = this.context$.pipe(
      switchMap((ctx) =>
        ctx?.orgId
          ? (docData(
              doc(this.firestore, `orgs/${ctx.orgId}/members/${ctx.uid}`)
            ) as Observable<Member | undefined>).pipe(
              map((m) => m ?? null),
              retry({ count: 4, delay: 1000 }),
              catchError(() => of(null))
            )
          : of(null)
      ),
      shareReplay(1)
    );

    this.role$ = this.membership$.pipe(
      map((m) => m?.role ?? null),
      distinctUntilChanged(),
      shareReplay(1)
    );

    this.pendingInvites$ = this.user$.pipe(
      switchMap((user) =>
        user?.email
          ? (collectionData(
              query(
                collectionGroup(this.firestore, "invites"),
                where("email", "==", user.email.toLowerCase())
              )
            ) as Observable<Invite[]>).pipe(catchError(() => of([])))
          : of([])
      ),
      shareReplay(1)
    );

    combineLatest([this.user$, this.context$, this.role$]).subscribe(
      ([user, ctx, role]) => {
        const consistent = !!user && ctx?.uid === user.uid;
        this.snapshot.next({
          uid: user?.uid ?? null,
          email: user?.email ?? null,
          orgId: consistent ? ctx!.orgId : null,
          role: consistent ? role : null,
        });
      }
    );

    // Auto-reparación: si a este usuario lo sacaron de su organización
    // activa, volver a su espacio personal. Solo con confirmación del
    // SERVIDOR y si el perfil es del usuario con sesión: una ausencia
    // momentánea (cambio de sesión, caché local) no debe mover a nadie.
    combineLatest([this.context$, this.membership$])
      .pipe(
        filter(([ctx, m]) => !!ctx?.orgId && m === null),
        debounceTime(1500)
      )
      .subscribe(([ctx]) => this.leaveIfRemoved(ctx!.uid, ctx!.orgId!));
  }

  private async leaveIfRemoved(uid: string, orgId: string): Promise<void> {
    if (orgId === personalOrgId(uid) || this.auth.currentUser?.uid !== uid) return;
    try {
      const member = await getDocFromServer(
        doc(this.firestore, `orgs/${orgId}/members/${uid}`)
      );
      if (member.exists() || this.auth.currentUser?.uid !== uid) return;
      await updateDoc(doc(this.firestore, `users/${uid}`), {
        [`orgs.${orgId}`]: deleteField(),
        activeOrgId: personalOrgId(uid),
      });
    } catch {
      // Sin red o sin permiso de lectura: no tocar nada.
    }
  }

  get uid(): string | null {
    return this.snapshot.value.uid;
  }

  get orgId(): string | null {
    return this.snapshot.value.orgId;
  }

  get role(): Role | null {
    return this.snapshot.value.role;
  }

  /**
   * Espera a que haya sesión y organización activa. Rechaza si no hay
   * sesión (en vez de colgarse para siempre).
   */
  async requireContext(): Promise<{ uid: string; orgId: string }> {
    const [user, ctx] = await firstValueFrom(
      combineLatest([this.user$, this.context$]).pipe(
        filter(([user, ctx]) => !user || (ctx?.uid === user.uid && !!ctx.orgId))
      )
    );
    if (!user || !ctx?.orgId) {
      throw new Error("No hay sesión activa. Iniciá sesión para continuar.");
    }
    return { uid: user.uid, orgId: ctx.orgId };
  }

  async requireOrgId(): Promise<string> {
    return (await this.requireContext()).orgId;
  }

  /** Observable que emite el orgId activo cada vez que cambia (nunca null). */
  activeOrgId$(): Observable<string> {
    return this.orgId$.pipe(filter((id): id is string => !!id));
  }

  // ---------------------------------------------------------------------
  //  Acciones
  // ---------------------------------------------------------------------

  async switchOrg(orgId: string): Promise<void> {
    const { uid } = await this.requireContext();
    await updateDoc(doc(this.firestore, `users/${uid}`), { activeOrgId: orgId });
  }

  /**
   * Crea una organización tipo colegio en plan de prueba. El creador
   * queda como administrador. Plan, cupos y créditos los ajusta ExamHub.
   */
  async createSchool(data: {
    name: string;
    nit?: string;
    daneCode?: string;
    city?: string;
  }): Promise<string> {
    const { uid } = await this.requireContext();
    const user = this.auth.currentUser!;
    const orgRef = doc(collection(this.firestore, "orgs"));
    const org: Omit<Organization, "id"> = {
      name: data.name.trim(),
      kind: "school",
      plan: "trial",
      seats: 100,
      aiCreditsMonthly: 200,
      settings: { ...DEFAULT_ORG_SETTINGS },
      createdBy: uid,
      createdAt: Date.now(),
      ...(data.nit?.trim() ? { nit: data.nit.trim() } : {}),
      ...(data.daneCode?.trim() ? { daneCode: data.daneCode.trim() } : {}),
      ...(data.city?.trim() ? { city: data.city.trim() } : {}),
    };
    const batch = writeBatch(this.firestore);
    batch.set(orgRef, org);
    batch.set(doc(this.firestore, `orgs/${orgRef.id}/members/${uid}`), {
      uid,
      email: (user.email ?? "").toLowerCase(),
      role: "admin",
      joinedAt: Date.now(),
    } satisfies Member);
    batch.set(
      doc(this.firestore, `users/${uid}`),
      {
        orgs: { [orgRef.id]: { name: org.name, role: "admin" } },
      },
      { merge: true }
    );
    await batch.commit();
    // Se activa DESPUÉS de que el servidor confirmó la membresía; si se
    // activa en el mismo batch, la UI pide el colegio antes de que las
    // reglas vean al nuevo miembro y la lectura es rechazada.
    await this.switchOrg(orgRef.id);
    return orgRef.id;
  }

  async acceptInvite(invite: Invite): Promise<void> {
    const { uid } = await this.requireContext();
    const user = this.auth.currentUser!;
    const batch = writeBatch(this.firestore);
    batch.set(doc(this.firestore, `orgs/${invite.orgId}/members/${uid}`), {
      uid,
      email: invite.email,
      role: invite.role,
      joinedAt: Date.now(),
      ...(user.displayName ? { displayName: user.displayName } : {}),
    } satisfies Member);
    batch.set(
      doc(this.firestore, `users/${uid}`),
      {
        orgs: { [invite.orgId]: { name: invite.orgName, role: invite.role } },
      },
      { merge: true }
    );
    await batch.commit();
    await this.switchOrg(invite.orgId);
    // La invitación se borra después: la regla de alta de miembro la lee.
    await this.declineInvite(invite);
  }

  async declineInvite(invite: Invite): Promise<void> {
    await deleteDoc(
      doc(this.firestore, `orgs/${invite.orgId}/invites/${invite.email}`)
    );
  }

  // ---------------------------------------------------------------------
  //  Bootstrap
  // ---------------------------------------------------------------------

  /**
   * Garantiza perfil + espacio personal. Idempotente: el id del espacio
   * personal es determinista (`p_<uid>`), así que dos pestañas abiertas
   * a la vez no crean duplicados.
   */
  private async bootstrap(user: User): Promise<void> {
    const userRef = doc(this.firestore, `users/${user.uid}`);
    const snap = await getDoc(userRef);
    const profile = snap.exists() ? (snap.data() as UserProfile) : null;
    if (profile && Object.keys(profile.orgs ?? {}).length > 0) {
      await this.syncMemberships(user.uid, profile);
      return;
    }

    const email = (user.email ?? "").toLowerCase();
    const orgId = personalOrgId(user.uid);
    const orgRef = doc(this.firestore, `orgs/${orgId}`);
    const orgExists = await getDoc(orgRef)
      .then((s) => s.exists())
      .catch(() => false);
    const name = `Espacio de ${user.displayName || email.split("@")[0]}`;

    const batch = writeBatch(this.firestore);
    if (!orgExists) {
      batch.set(orgRef, {
        name,
        kind: "personal",
        plan: "personal",
        seats: 0,
        aiCreditsMonthly: 20,
        settings: { ...DEFAULT_ORG_SETTINGS },
        createdBy: user.uid,
        createdAt: Date.now(),
      } satisfies Omit<Organization, "id">);
      batch.set(doc(this.firestore, `orgs/${orgId}/members/${user.uid}`), {
        uid: user.uid,
        email,
        role: "admin",
        joinedAt: Date.now(),
      } satisfies Member);
    }
    batch.set(
      userRef,
      {
        uid: user.uid,
        email,
        orgs: { [orgId]: { name, role: "admin" } },
        activeOrgId: profile?.activeOrgId ?? orgId,
      },
      { merge: true }
    );
    await batch.commit();
    await this.syncMemberships(user.uid, profile);
  }

  /**
   * La lista de organizaciones del perfil es solo un caché: la verdad
   * son los documentos `orgs/{id}/members/{uid}`. Si el caché perdió
   * alguna (o nunca la tuvo), se recupera aquí. Sin red o sin el índice
   * desplegado, simplemente no hace nada.
   */
  private async syncMemberships(uid: string, profile: UserProfile | null): Promise<void> {
    try {
      const snap = await getDocs(
        query(collectionGroup(this.firestore, "members"), where("uid", "==", uid))
      );
      const missing: Record<string, { name: string; role: Role }> = {};
      for (const m of snap.docs) {
        const orgId = m.ref.parent.parent?.id;
        if (!orgId || profile?.orgs?.[orgId]) continue;
        const org = await getDoc(doc(this.firestore, `orgs/${orgId}`)).catch(() => null);
        missing[orgId] = {
          name: (org?.data() as Organization | undefined)?.name ?? "Organización",
          role: (m.data() as Member).role,
        };
      }
      if (Object.keys(missing).length > 0) {
        await setDoc(doc(this.firestore, `users/${uid}`), { orgs: missing }, { merge: true });
      }
    } catch (err) {
      console.warn("[Tenant] No se pudieron sincronizar las membresías:", err);
    }
  }
}

/** Organización activa según el perfil (o la personal / la primera). */
function activeOrgOf(p: UserProfile): string | null {
  const ids = Object.keys(p.orgs ?? {});
  if (p.activeOrgId && ids.includes(p.activeOrgId)) return p.activeOrgId;
  return ids.includes(personalOrgId(p.uid)) ? personalOrgId(p.uid) : ids[0] ?? null;
}
