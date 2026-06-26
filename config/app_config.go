package config


type AppConfig struct {
	Env string
	IsDev bool
}

// investigare cosa e una Option per gestire questo meglio 

func NewAppConfig(env string) *AppConfig {
	return &AppConfig{
		Env: env,
		IsDev: env == "DEV",
	}
}

