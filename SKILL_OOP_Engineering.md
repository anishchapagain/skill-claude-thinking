---
name: oop-application-engineering
description: >
  Expert-level guidance for building general applications using Object-Oriented Design,
  SOLID principles, validation-first patterns, and configurable/extensible architectures.
  Trigger this skill whenever the user is: designing classes, interfaces, or object hierarchies;
  asking about SOLID violations or refactoring toward SOLID; building domain models, entities,
  value objects, or aggregates; implementing validators, DTOs, schemas, or input contracts;
  creating configurable systems, factory patterns, strategy patterns, or dependency injection;
  writing service layers, repositories, or application use-cases; designing any application
  where correctness, extensibility, and maintainability matter. Trigger even for partial questions
  like "how do I structure this class" or "is this violating SOLID" or "where should validation
  go". Calibrated for engineers with 10+ years of experience — skip basics, go deep on tradeoffs.
---

# OOP Application Engineering Skill

**Audience**: Senior engineers with 10+ years. Language-agnostic — examples may be TypeScript,
Python, Java, or C# depending on context. Ask if not clear.
**Tone**: Precise. Pattern-aware. Tradeoffs always stated. No cargo-culting.

---

## 0. Intake Protocol

Before producing any class design or code, silently resolve:

1. **Language & runtime** — Strongly typed? Compiled? GC'd? Async model?
2. **Application layer** — CLI tool, REST API, background worker, domain library?
3. **Persistence model** — ORM, raw SQL, document store, in-memory?
4. **Team convention baseline** — Existing patterns to honor or explicit ones to replace?
5. **Volatility axis** — Which parts of this system change most often?

Surface only unresolved gaps. Never ask what's already in context.

---

## 1. Object-Oriented Design Foundations

### 1.1 The Four Pillars — Applied, Not Textbook

**Encapsulation**
- State is private by default. Expose **behavior**, not data.
- Getters that return raw mutable collections break encapsulation. Return copies, views, or projection types.
- Ask: *can a caller corrupt object state without calling a method?* If yes — broken.

**Abstraction**
- An abstraction is a **contract**, not a summary. It must hide *how*, not just *what*.
- A class named `UserService` that exposes 20 methods is not an abstraction — it's a namespace.
- Abstractions should be **stable**. If the interface changes every sprint, it wasn't a real abstraction.

**Inheritance**
- Prefer **composition over inheritance** as a default. Use inheritance only for true `is-a` relationships with stable hierarchies.
- Depth > 2 in an inheritance chain is a warning sign. Depth > 3 is a smell.
- Never use inheritance for code reuse alone — that's what mixins, traits, and composition are for.

**Polymorphism**
- Design for polymorphism at seams: payment processors, notification channels, export formats, auth strategies.
- Prefer **interface polymorphism** over class polymorphism — callers should depend on the interface, not the base class.

### 1.2 Class Design Checklist

Before finalizing any class:

- [ ] Single, nameable responsibility (can be stated in one clause without "and")
- [ ] All dependencies injected — no `new ConcreteType()` inside business logic
- [ ] No static mutable state
- [ ] Validation on construction — object is **always valid** once instantiated
- [ ] Immutable where possible — especially Value Objects
- [ ] No public setters on domain entities (use methods that express intent)
- [ ] Size: if it exceeds ~200 LOC, decompose

### 1.3 Domain Object Taxonomy

| Type | Identity | Mutable | Validates | Example |
|---|---|---|---|---|
| **Value Object** | By value | No | At construction | `Money`, `Email`, `DateRange` |
| **Entity** | By ID | Yes (controlled) | At construction + mutation | `Order`, `User`, `Invoice` |
| **Aggregate** | Root entity ID | Root controls all | Root enforces invariants | `Order` + `OrderLines` |
| **Domain Service** | Stateless | N/A | Input only | `PricingCalculator` |
| **DTO** | None | Transport only | At boundary (not inside domain) | `CreateOrderRequest` |
| **Repository** | N/A | N/A | None | `OrderRepository` |

**Rules:**
- Value Objects are never `null` — model absence with `Optional<T>` or a `NullObject` variant.
- Entities never expose internal collections directly — only aggregate-level methods.
- DTOs never leak into domain layer. Map at the boundary.

---

## 2. SOLID Principles — Enforcement Level

### 2.1 Single Responsibility Principle (SRP)

**Definition**: A class has one reason to change — meaning one actor/stakeholder owns it.

**Violations to catch:**
- A service class that both fetches data *and* formats it for the UI.
- A `User` class that handles authentication, profile management, and notification preferences.
- Any class with method names from more than one domain concept.

**Refactor signal**: If you can split a class and neither half needs the other — it was two classes.

```
// Violation
class OrderService {
  placeOrder() { ... }
  generatePDFInvoice() { ... }   // ← different actor (finance/reporting)
  sendConfirmationEmail() { ... } // ← different actor (comms)
}

// Correct decomposition
class OrderService       { placeOrder() }
class InvoiceGenerator   { generatePDF(order) }
class OrderNotifier      { sendConfirmation(order) }
```

### 2.2 Open/Closed Principle (OCP)

**Definition**: Open for extension, closed for modification. Add behavior without touching existing code.

**Implementation patterns:**
- **Strategy Pattern** — swap algorithms at runtime via interface injection.
- **Decorator Pattern** — wrap behavior without modifying the wrapped class.
- **Plugin/Hook registry** — register new behavior against an extension point.

**Violation signal**: A `switch` or `if/else if` chain on a type enum inside a core class. Every new type requires modifying that class.

```
// Violation — add a payment type = modify PaymentProcessor
class PaymentProcessor {
  process(payment) {
    if (payment.type === 'stripe') { ... }
    else if (payment.type === 'paypal') { ... }
  }
}

// OCP-compliant — add a payment type = add a new class
interface PaymentGateway { charge(amount: Money): Receipt }
class StripeGateway implements PaymentGateway { ... }
class PaypalGateway implements PaymentGateway { ... }
class PaymentProcessor { constructor(private gateway: PaymentGateway) {} }
```

### 2.3 Liskov Substitution Principle (LSP)

**Definition**: Subtypes must be substitutable for their base types without altering correctness.

**Violations to catch:**
- Overridden method throws an exception the base type never throws.
- Subclass weakens preconditions or strengthens postconditions beyond the contract.
- The infamous `Rectangle / Square` problem — Square breaks Rectangle's invariant (`setWidth` must not change height).

**Test**: If you find yourself checking `instanceof` before calling a method — LSP is broken somewhere.

**Fix pattern**: Prefer interface segregation over deep inheritance. If the subtype can't honor the full contract, it needs a different interface, not a narrower override.

### 2.4 Interface Segregation Principle (ISP)

**Definition**: Clients should not depend on methods they don't use.

**Violations to catch:**
- A `UserRepository` interface with 15 methods, but most implementations only need 4.
- A "God interface" that all services implement, forcing stub/no-op methods.

```
// Violation
interface UserRepository {
  findById(), findAll(), save(), delete(),
  findByEmail(), findByOAuthToken(),
  exportToCSV(), generateAuditReport()  // ← different concerns
}

// ISP-compliant
interface UserReader       { findById(), findByEmail() }
interface UserWriter       { save(), delete() }
interface UserExporter     { exportToCSV() }
interface UserAuditSource  { generateAuditReport() }
```

**Rule**: Interfaces should be client-driven, not implementation-driven. Define an interface for what a *caller* needs, not what an *implementor* can provide.

### 2.5 Dependency Inversion Principle (DIP)

**Definition**: High-level modules depend on abstractions; abstractions do not depend on details.

**Violations to catch:**
- Business logic class instantiates its own database connection.
- Domain service imports from an infrastructure package.
- `new ConcreteRepository()` inside an application service.

**Implementation**: Dependency Injection (constructor injection preferred).

```
// Violation
class OrderService {
  private repo = new PostgresOrderRepository() // ← concrete, hard to test
}

// DIP-compliant
class OrderService {
  constructor(private repo: OrderRepository) {} // ← depends on abstraction
}
```

**DI Container rules:**
- Register dependencies at the **composition root** (app entry point) — not inside modules.
- Prefer constructor injection. Property injection only for optional/optional-override dependencies.
- Never use a service locator pattern inside business logic — it hides dependencies.

---

## 3. Validation-First Architecture

**Core rule**: An invalid object must never exist. Validate at the boundary; trust inside.

### 3.1 Validation Layers

```
[External Boundary]
  Request/Input DTO
       ↓ Schema Validation (shape, types, required fields)
       ↓ Semantic Validation (business rules, cross-field rules)
  [Domain Boundary]
       ↓ Value Object construction (self-validating)
       ↓ Entity invariant enforcement (on mutation methods)
  [Persistence Boundary]
       ↓ DB constraints as last-line safety net (NOT primary validation)
```

**Never** push validation down to the DB layer as the primary defense. It produces poor error messages, is not testable in isolation, and couples your domain to infrastructure.

### 3.2 Value Object Validation Pattern

Value Objects self-validate at construction. They either succeed or throw a domain exception — never return `null` or an invalid instance.

```typescript
class Email {
  private readonly value: string

  private constructor(value: string) {
    this.value = value
  }

  static create(raw: string): Result<Email, ValidationError> {
    if (!raw || raw.trim().length === 0)
      return Err(new ValidationError('Email cannot be empty'))
    if (!EMAIL_REGEX.test(raw))
      return Err(new ValidationError(`Invalid email format: ${raw}`))
    return Ok(new Email(raw.toLowerCase().trim()))
  }

  toString() { return this.value }
}
```

**Pattern notes:**
- Private constructor — forces use of factory method.
- `Result<T, E>` return type (Railway-oriented) — no exceptions for expected validation failures.
- Normalization (trim, lowercase) happens inside the constructor — callers get canonical form.

### 3.3 Request DTO Validation

Validate at the **entry point** of each use case. Use a schema library appropriate to the language:

| Language | Preferred Library |
|---|---|
| TypeScript | Zod, class-validator + class-transformer |
| Python | Pydantic v2 |
| Java | Bean Validation (Jakarta) + Hibernate Validator |
| C# | FluentValidation |
| Go | go-playground/validator + custom |

**Validation schema rules:**
- Declare **all** field constraints in the schema: type, format, min/max, nullable.
- Coerce types at the schema layer — domain should receive already-typed values.
- Collect **all** errors before returning — never return on first failure (fail-accumulate, not fail-fast) for user-facing APIs.
- Return a structured error: `{ field, code, message }` — never raw exception messages.

```typescript
// Zod example — collect all errors
const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(1000),
  })).min(1, 'Order must have at least one item'),
  deliveryDate: z.coerce.date().min(new Date(), 'Delivery date must be in the future'),
})

// Returns all errors, not just first
const result = CreateOrderSchema.safeParse(input)
if (!result.success) {
  return ValidationFailure(result.error.flatten().fieldErrors)
}
```

### 3.4 Domain Invariant Enforcement

Entity methods must enforce invariants **before** mutating state.

```typescript
class Order {
  private status: OrderStatus
  private lines: OrderLine[]

  addLine(line: OrderLine): Result<void, DomainError> {
    if (this.status !== OrderStatus.DRAFT)
      return Err(new DomainError('Cannot add lines to a non-draft order'))
    if (this.lines.length >= 100)
      return Err(new DomainError('Order cannot exceed 100 lines'))
    this.lines.push(line)
    return Ok()
  }

  confirm(): Result<void, DomainError> {
    if (this.lines.length === 0)
      return Err(new DomainError('Cannot confirm an empty order'))
    this.status = OrderStatus.CONFIRMED
    this.recordEvent(new OrderConfirmedEvent(this.id))
    return Ok()
  }
}
```

**Invariant rules:**
- Every state transition is a named method — never expose `setStatus()`.
- Invariants are documented as code comments above the class, not just in tests.
- Failed invariant checks return domain errors, not generic exceptions.

### 3.5 Validation Error Taxonomy

| Error Type | Thrown When | HTTP Equivalent |
|---|---|---|
| `SchemaValidationError` | Input shape/type is wrong | 400 |
| `BusinessRuleViolation` | Valid input, invalid business state | 422 |
| `DomainInvariantError` | Entity invariant broken internally | 500 (bug) |
| `NotFoundError` | Referenced entity doesn't exist | 404 |
| `ConflictError` | State conflict (duplicate, race) | 409 |
| `AuthorizationError` | Caller lacks permission | 403 |

Never expose `DomainInvariantError` to callers — it indicates a bug in the application, not a user error.

---

## 4. Configurability Patterns

### 4.1 Configuration Object Pattern

Never scatter `config.get('X')` calls through business logic. Inject typed config objects.

```typescript
// Typed, validated config — fail at startup if invalid
class PaymentConfig {
  readonly maxRetries: number        // default: 3, range: 1-10
  readonly timeoutMs: number         // default: 5000
  readonly currency: CurrencyCode    // required
  readonly gatewayUrl: URL           // required, must be https

  static fromEnv(): Result<PaymentConfig, ConfigError> { ... }
}

class PaymentService {
  constructor(
    private gateway: PaymentGateway,
    private config: PaymentConfig,   // ← typed, validated, injected
  ) {}
}
```

### 4.2 Strategy Pattern for Configurability

When behavior needs to vary by configuration or runtime condition — use Strategy.

```
StrategyRegistry<T> {
  register(key: string, strategy: T): void
  resolve(key: string): T              // throws if unknown key
  resolveOrDefault(key: string): T     // falls back to default
}
```

**Usage scenarios**: notification channel (email/SMS/push), export format (CSV/PDF/JSON), payment gateway, auth provider, cache backend.

### 4.3 Factory Pattern

Use factories when:
- Object construction is complex (multi-step, conditional, dependent)
- The concrete type varies by configuration/input
- Construction requires access to infrastructure (DB lookups, external calls)

```typescript
interface ReportGeneratorFactory {
  create(format: ReportFormat): ReportGenerator
}

class ReportGeneratorFactoryImpl implements ReportGeneratorFactory {
  create(format: ReportFormat): ReportGenerator {
    switch (format) {
      case ReportFormat.PDF:  return new PDFReportGenerator(this.pdfConfig)
      case ReportFormat.CSV:  return new CSVReportGenerator()
      case ReportFormat.XLSX: return new ExcelReportGenerator(this.excelConfig)
      default: throw new ConfigurationError(`Unsupported format: ${format}`)
    }
  }
}
```

**Note**: Factories are one of the few places a `switch` on type is appropriate — it lives in the infrastructure/composition layer, not domain logic.

### 4.4 Builder Pattern

Use for objects with many optional parameters or complex construction sequences.

- Builder validates the **complete configuration** on `build()`, not on each setter call.
- Builders return `Result<T, ValidationError>` from `build()` — construction failure is a first-class case.
- Immutable result: `build()` returns a fully-constructed, read-only object.

---

## 5. Application Layer Structure

### 5.1 Canonical Layer Map

```
src/
├── domain/              # Pure business logic — no framework, no infra imports
│   ├── entities/
│   ├── value-objects/
│   ├── repositories/    # Interfaces only
│   ├── services/        # Domain services (stateless logic)
│   └── events/          # Domain events
│
├── application/         # Use cases / application services
│   ├── use-cases/       # One class per use case
│   ├── dtos/            # Input/output contracts
│   └── validators/      # DTO-level schema validators
│
├── infrastructure/      # Concrete implementations
│   ├── persistence/     # Repository implementations, ORM models
│   ├── http/            # Controllers, middleware, route definitions
│   ├── messaging/       # Queue producers/consumers
│   └── config/          # Config loading, DI container setup
│
└── shared/              # Cross-cutting: Result type, base errors, utils
```

**Hard rules:**
- `domain/` imports nothing from `application/` or `infrastructure/`.
- `application/` imports from `domain/` only — never from `infrastructure/`.
- `infrastructure/` implements interfaces defined in `domain/` and `application/`.
- Circular imports between any layers = architectural violation. Enforce with linting (`dependency-cruiser`, `import-boundaries`).

### 5.2 Use Case Pattern

Each use case is a class with a single `execute()` method.

```typescript
class PlaceOrderUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private productRepo: ProductRepository,
    private eventBus: DomainEventBus,
    private validator: CreateOrderValidator,
  ) {}

  async execute(request: CreateOrderRequest): Promise<Result<OrderId, AppError>> {
    // 1. Validate input
    const validation = this.validator.validate(request)
    if (validation.isFailure) return Err(validation.error)

    // 2. Load dependencies
    const customer = await this.customerRepo.findById(request.customerId)
    if (!customer) return Err(new NotFoundError('Customer', request.customerId))

    // 3. Execute domain logic
    const orderResult = Order.create(customer, request.items)
    if (orderResult.isFailure) return Err(orderResult.error)

    // 4. Persist
    await this.orderRepo.save(orderResult.value)

    // 5. Publish events
    await this.eventBus.publish(orderResult.value.pullDomainEvents())

    return Ok(orderResult.value.id)
  }
}
```

**Use case rules:**
- One class, one public method (`execute`), one responsibility.
- Returns `Result<SuccessType, ErrorType>` — never throws for expected failures.
- Does not contain UI/framework logic. Controllers call use cases; use cases never know about HTTP.
- Idempotency: use cases that mutate state must document their idempotency behavior.

---

## 6. Code Quality & Anti-Pattern Reference

### 6.1 OOP Anti-Patterns — Identify & Fix

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Anemic Domain Model** | Entities are data bags; all logic in services | Move behavior into entities |
| **God Class** | One class with 30+ methods across concerns | Decompose by SRP |
| **Feature Envy** | Method uses another class's data more than its own | Move method to the class it envies |
| **Primitive Obsession** | `string email`, `number price` everywhere | Wrap in Value Objects |
| **Inappropriate Intimacy** | Class accesses another's private internals | Encapsulate via public API |
| **Shotgun Surgery** | One change requires edits in 10+ classes | Consolidate via SRP / cohesion |
| **Data Clump** | Same 3-4 fields always appear together | Extract into a class/value object |
| **Lazy Class** | Class does almost nothing | Merge into related class |
| **Refused Bequest** | Subclass ignores inherited methods | Prefer composition; fix LSP |

### 6.2 Naming Conventions (Non-Negotiable)

- Classes: nouns. Methods: verb phrases. Interfaces: capability adjectives or nouns (`Exportable`, `OrderRepository`).
- No `Manager`, `Handler`, `Helper`, `Util`, `Processor` unless genuinely apt — these are SRP escape hatches.
- Booleans: `is`, `has`, `can`, `should` prefix. Never `flag`, `check`, `status` as a boolean name.
- Collections: plural noun (`orders`, `lineItems`) — never `list`, `array`, `data`.
- Result types: name the success (`OrderId`, `InvoiceUrl`) — never return `boolean` to indicate success.

### 6.3 Testing Alignment

- Value Objects: unit-test all construction paths — valid, boundary, and invalid inputs.
- Use Cases: unit-test with mocked repositories. Integration-test with real persistence in CI.
- Domain Services: pure unit tests — no mocks needed if properly isolated.
- Validators: test all rule combinations, especially cross-field rules.
- Invariants: every entity invariant must have a failing test that proves enforcement.

---

## 7. Output Formats

When producing artifacts for this skill:

- **Class designs** → UML-style Mermaid class diagram + annotated code skeleton
- **Refactoring proposals** → Before/after code side-by-side with SOLID violation named
- **Validation schemas** → Full annotated schema with all constraints and error messages
- **Layer structure** → Directory tree with responsibility note per folder
- **Domain models** → Entity/VO/Service breakdown table + relationship description
- **Use cases** → Pseudocode flow (validate → load → execute → persist → publish) before code

Always state: *which SOLID principle applies*, *what the tradeoff is*, and *what breaks if this rule is skipped*.

---

## 8. Red Flags — Raise Before Proceeding

- Business logic inside a controller, view, or route handler.
- `new ConcreteClass()` anywhere inside a domain or application service.
- Validation that only happens at the DB constraint level.
- An entity with public setters on all fields.
- A `UserService` with more than ~6–8 methods — SRP likely violated.
- `instanceof` checks inside a method that should be polymorphic.
- Inheritance chain > 2 levels for anything that isn't a framework base class.
- A boolean return from a method that mutates state — hides failure modes.
- Shared mutable static state across requests in a web application context.
