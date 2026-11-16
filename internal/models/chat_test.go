package models

import (
	"strings"
	"testing"
)

func TestBuildChapterChatSystemPromptIncludesChapterOnFollowUp(t *testing.T) {
	chapterExcerpt := "Thinking can question what the world means."
	recentConversation := "User: Explain Arendt's view.\nAI: Thinking examines meaning."

	prompt := buildChapterChatSystemPrompt(
		"Arendt and Heidegger",
		"Thinking and Meaning",
		chapterExcerpt,
		recentConversation,
		false,
	)

	for _, expected := range []string{chapterExcerpt, recentConversation} {
		if !strings.Contains(prompt, expected) {
			t.Errorf("follow-up prompt does not contain %q", expected)
		}
	}
}
