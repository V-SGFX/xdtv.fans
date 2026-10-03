import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  /*
   * Nazwa konta: WYŁĄCZNIE litery bez ogonków, cyfry, podkreślenie i myślnik.
   *
   * Bez tego da się założyć konto `admın` (z tureckim ı), nieodróżnialne
   * wzrokiem od `admin` — podszywanie się pod administrację jedną literą.
   * Drugi powód: nazwa idzie wprost do adresu `/profile/:username`, więc
   * znaki spoza ASCII rozjeżdżają odnośniki i kodowanie procentowe.
   *
   * Istniejące konta nie są ruszane. Sprawdzone: wszystkie dziesięć
   * obecnych nazw tę regułę spełnia.
   */
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Nazwa może zawierać tylko litery bez polskich znaków, cyfry, podkreślenie i myślnik.',
  })
  username: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class LoginDto {
  @IsString()
  login: string;

  @IsString()
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}
