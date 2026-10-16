"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
exports.handleProfileEditModal = handleProfileEditModal;
const discord_js_1 = require("discord.js");
const db_1 = require("../lib/db");
const usage_1 = require("../lib/usage");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName("profile-edit")
    .setDescription("Edit your Fortify profile — niche, skills, what you're looking for.");
async function execute(interaction) {
    const user = await (0, usage_1.getOrCreateUser)(interaction.user.id, interaction.user.username);
    const profile = await db_1.db.profile.findUnique({ where: { userId: user.id } });
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId(`profile_edit_modal_${interaction.user.id}`)
        .setTitle("Edit your Fortify profile");
    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
        .setCustomId("profile_niche")
        .setLabel("Your niche")
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder("e.g. E-commerce growth for DTC brands")
        .setValue(profile?.niche ?? "")
        .setRequired(false)
        .setMaxLength(120)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
        .setCustomId("profile_skills")
        .setLabel("Your skills (comma-separated)")
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder("paid ads, email marketing, CRO")
        .setValue((profile?.skills ?? []).join(", "))
        .setRequired(false)
        .setMaxLength(200)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
        .setCustomId("profile_looking_for")
        .setLabel("What you're looking for (comma-separated)")
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder("co-founder, agency clients, mentorship")
        .setValue((profile?.lookingFor ?? []).join(", "))
        .setRequired(false)
        .setMaxLength(200)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
        .setCustomId("profile_can_offer")
        .setLabel("What you can offer (comma-separated)")
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setPlaceholder("intros to suppliers, funnel audits")
        .setValue((profile?.canOffer ?? []).join(", "))
        .setRequired(false)
        .setMaxLength(200)));
    await interaction.showModal(modal);
}
/** Splits a comma-separated field into a trimmed, de-duplicated list. */
function parseList(raw) {
    return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 15);
}
/** Handles the profile_edit_modal_* submission. Called from the index.ts modal router. */
async function handleProfileEditModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const user = await (0, usage_1.getOrCreateUser)(interaction.user.id, interaction.user.username);
    const niche = interaction.fields.getTextInputValue("profile_niche").trim();
    const skills = parseList(interaction.fields.getTextInputValue("profile_skills"));
    const lookingFor = parseList(interaction.fields.getTextInputValue("profile_looking_for"));
    const canOffer = parseList(interaction.fields.getTextInputValue("profile_can_offer"));
    const data = { niche: niche || null, skills, lookingFor, canOffer };
    await db_1.db.profile.upsert({
        where: { userId: user.id },
        update: data,
        create: { userId: user.id, ...data },
    });
    const summary = [
        `**Niche:** ${niche || "—"}`,
        `**Skills:** ${skills.length ? skills.join(", ") : "—"}`,
        `**Looking for:** ${lookingFor.length ? lookingFor.join(", ") : "—"}`,
        `**Can offer:** ${canOffer.length ? canOffer.join(", ") : "—"}`,
    ].join("\n");
    await interaction.editReply(`✅ Profile updated.\n\n${summary}`);
}
